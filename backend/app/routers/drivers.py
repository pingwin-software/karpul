"""Who drives a ride: an admin letting a shared car past the share through
(or not), a passenger taking over a car whose driver cancelled, and someone
claiming the rides that go by a name like theirs."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from .. import audit
from ..access import booking_of, get_ride_or_404, may_run, on_behalf
from ..admin import require_admin
from ..auth import CredsDep, require_user
from ..database import get_session, get_write_session
from ..driverless import driver_found
from ..events import ride_saved
from ..models import Booking, CarType, Ride, User, utcnow
from ..push import notify
from ..ride_removal import remove_rides
from ..schemas import RideRead
from ..services import (
    board_extras,
    claim_driver_rides,
    ensure_car_available,
    promote_waitlist,
    similar_names,
    to_ride_read_dict,
)

router = APIRouter(prefix="/api/rides", tags=["rides"])

SessionDep = Annotated[Session, Depends(get_session)]
# Every mutation is check-then-write (free seats, car availability, ownership),
# so it runs under the write lock from the first statement (database.begin_write).
WriteSessionDep = Annotated[Session, Depends(get_write_session)]


def _hand_to(session: Session, ride: Ride, driver: User, told_by: str) -> None:
    """`driver` drives a ride whose driver cancelled: their seat, if they had
    one, goes to the queue, the passengers are told `told_by` drives now (the
    new driver's name), and every tab hears. Commits."""
    booking = booking_of(ride, driver)
    if booking is not None:
        ride.bookings.remove(booking)
        session.delete(booking)
    ride.driver_id = driver.id
    ride.driver_name = driver.display_name
    driver_found(ride)
    new_stops: list[Booking] = []
    promoted = promote_waitlist(session, ride, new_stops)
    session.add(ride)
    session.commit()
    session.refresh(ride)
    ride_saved(ride, created=False)
    notify(session, [b.passenger_id for b in ride.bookings if b not in promoted], "driver_found", ride, name=told_by)
    if promoted:
        notify(session, [b.passenger_id for b in promoted], "seat_freed", ride, driver=ride.driver_name)
    for b in new_stops:
        notify(session, [ride.driver_id], "stop_added", ride, name=b.passenger_name, place=b.pickup)


@router.post("/{ride_id}/takeover", response_model=RideRead)
def take_over(ride_id: int, session: WriteSessionDep, creds: CredsDep):
    """A passenger of a shared car whose driver cancelled (`needs_driver`)
    drives it instead: they become its driver, their seat is free for the
    queue, and the others in the car are told. The ride was already within
    someone's share of the shared cars, so it is not counted against theirs
    afresh: it is a rescue, not another booking."""
    user = require_user(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if not ride.needs_driver:
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride already has a driver")
    if booking_of(ride, user) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a passenger in this car can take it over")
    _hand_to(session, ride, user, user.display_name)
    return to_ride_read_dict(ride)


class DriverPick(BaseModel):
    driver_id: int


@router.post("/{ride_id}/driver", response_model=RideRead)
def pick_driver(ride_id: int, payload: DriverPick, session: WriteSessionDep, creds: CredsDep):
    """Admin-only: a shared car whose driver cancelled gets a driver the
    admin found, a passenger in it or anyone else with an account. Like a
    takeover it is a rescue, so nobody's share is checked; the new driver is
    told they were put down to drive."""
    admin = require_admin(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if not ride.needs_driver:
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride already has a driver")
    driver = session.get(User, payload.driver_id)
    if driver is None or driver.disabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    audit.record(session, admin, "driver_picked", driver.display_name, ride=ride)
    _hand_to(session, ride, driver, driver.display_name)
    if driver.id != admin.id:
        notify(session, [driver.id], "ride_assigned", ride, name=admin.display_name)
    return to_ride_read_dict(ride)


@router.post("/{ride_id}/confirm", response_model=RideRead)
def confirm_ride(ride_id: int, session: WriteSessionDep, creds: CredsDep):
    """The driver (or an admin) says a ride from the shared car's paper log
    (`Ride.unconfirmed`, app/backfill.py) is real as it stands: from now on
    colleagues can get in, as in any other ride."""
    user = require_user(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if not may_run(user, ride):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the driver or an admin can confirm this ride")
    if not ride.unconfirmed:
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride is already confirmed")
    ride.unconfirmed = False
    session.add(ride)
    if on_behalf(user, ride):
        audit.record(session, user, "ride_confirmed", ride.driver_name, ride=ride)
    session.commit()
    session.refresh(ride)
    ride_saved(ride, created=False)
    return to_ride_read_dict(ride)


@router.post("/{ride_id}/approve", response_model=RideRead)
def approve_ride(ride_id: int, session: WriteSessionDep, creds: CredsDep):
    """Admin-only: let a shared-car ride past the driver's share through.
    A pending ride holds no slot, so someone may have taken the car since it
    was asked for: the car must still be free then, or it is the usual 409."""
    admin = require_admin(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if ride.approval != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride is not waiting for approval")
    if ride.corporate_car_id is not None:
        ensure_car_available(
            session, ride.corporate_car_id, ride.ride_date, ride.departure_time, ride.return_time, exclude_ride_id=ride.id
        )
    ride.approval = "approved"
    session.add(ride)
    audit.record(session, admin, "ride_approved", ride.driver_name, ride=ride)
    session.commit()
    session.refresh(ride)
    ride_saved(ride, created=False)
    notify(session, [ride.driver_id], "ride_approved", ride, name=admin.display_name)
    return to_ride_read_dict(ride)


class OfficeMail(BaseModel):
    # The mail was for the first of a weekly series and said so: the coming
    # weeks are covered by it too.
    series: bool = False


@router.post("/{ride_id}/office-mail", response_model=RideRead)
def office_mailed(ride_id: int, payload: OfficeMail, session: WriteSessionDep, creds: CredsDep):
    """The driver (or an admin) says the mail to the office about this shared
    car went out (`Ride.office_mailed_at`): from the sheet after taking the
    car, or *I already sent it* later. The app cannot see the driver's own
    mail app, so this is their word, kept as the record. Saying it twice
    keeps the first time."""
    user = require_user(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if not may_run(user, ride):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the driver or an admin can say the office was told")
    if ride.car_type != CarType.corporate:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a shared car's ride goes to the office")
    if ride.approval == "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride is not approved yet")
    rides = [ride]
    if payload.series and ride.series_id:
        rides += session.exec(
            select(Ride).where(
                Ride.series_id == ride.series_id,
                Ride.ride_date > ride.ride_date,
                Ride.car_type == CarType.corporate,
                Ride.approval != "pending",
            )
        ).all()
    now = utcnow()
    told = [r for r in rides if r.office_mailed_at is None]
    for r in told:
        r.office_mailed_at = now
        session.add(r)
    session.commit()
    for r in told:
        session.refresh(r)
        ride_saved(r, created=False)
    session.refresh(ride)
    return to_ride_read_dict(ride)


@router.post("/{ride_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_ride(ride_id: int, session: WriteSessionDep, creds: CredsDep):
    """Admin-only: refuse a shared-car ride waiting for approval. The ride
    goes, as if cancelled; the driver is told it was declined."""
    admin = require_admin(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if ride.approval != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride is not waiting for approval")
    notify(session, [ride.driver_id], "ride_declined", ride, name=admin.display_name)
    remove_rides(session, admin, [ride], action="ride_declined", tell_driver=False)


@router.post("/{ride_id}/claim", response_model=list[RideRead])
def claim_ride(ride_id: int, session: WriteSessionDep, creds: CredsDep):
    """"This is me": take over a ride whose driver is a name with no account
    (the shared car's paper log, `app/backfill.py`, wrote people who had not
    registered yet). Registering already claims a name typed exactly as the
    account's (`claim_rows`); this is for one typed another way, so the two
    names must be alike (`similar_names`), and it claims every ride that goes
    by that name at once. Returns the rides claimed, this one first."""
    user = require_user(session, creds)
    ride = get_ride_or_404(session, ride_id)
    if ride.driver_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This ride's driver already has an account")
    if not similar_names(ride.driver_name, user.display_name):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{ride.driver_name} is not a name like yours")
    if booking_of(ride, user) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{user.display_name} already joined this ride")
    claimed = claim_driver_rides(session, user, ride.driver_name)
    claimed.sort(key=lambda r: (r.id != ride.id, r.ride_date, r.departure_time, r.id))
    session.commit()
    for r in claimed:
        session.refresh(r)
        ride_saved(r, created=False)
    extras = board_extras(session, claimed)
    return [to_ride_read_dict(r, extras) for r in claimed]
