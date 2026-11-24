"""A shared car whose driver cancelled (`Ride.needs_driver`): until when its
passengers have to find a driver, and the one reminder before that.

The ride keeps the car while the passengers decide, so it must not keep it
until the moment it was meant to leave: by then nobody can book the car or
find another seat. It gets a deadline when the driver cancels
(`Ride.driver_deadline`): the evening before at `EVENING_HOUR`, when that is
still `MIN_NOTICE` away; otherwise `LAST_CALL` before departure, but never
sooner than `SHORTEST` from now and never after departure. Nobody by then,
`reminders.drop_driverless` cancels it. `NUDGE_BEFORE` the deadline, the
passengers and the admins are reminded once (`Ride.driver_nudged`); a
deadline closer than that when the driver cancels gets no reminder, the first
push is still fresh. The frontend reads the deadline from `RideRead`.
"""

from datetime import datetime, time, timedelta

from .models import Ride

EVENING_HOUR = 18
MIN_NOTICE = timedelta(hours=3)
LAST_CALL = timedelta(hours=1)
SHORTEST = timedelta(minutes=30)
NUDGE_BEFORE = timedelta(hours=3)


def leaves_at(ride: Ride) -> datetime:
    return datetime.combine(ride.ride_date, ride.departure_time)


def deadline_for(ride: Ride, now: datetime) -> datetime:
    """When a ride whose driver cancels at `now` goes, if nobody takes it."""
    leaves = leaves_at(ride)
    evening = datetime.combine(ride.ride_date - timedelta(days=1), time(EVENING_HOUR))
    if evening - now >= MIN_NOTICE:
        return evening
    return min(leaves, max(leaves - LAST_CALL, now + SHORTEST))


def deadline_of(ride: Ride) -> datetime:
    """The stored deadline, or departure for a ride from before deadlines."""
    return ride.driver_deadline or leaves_at(ride)


def ask_for_driver(ride: Ride, now: datetime) -> None:
    """The driver cancelled: the ride waits for one of its passengers."""
    ride.needs_driver = True
    ride.driver_deadline = deadline_for(ride, now)
    ride.driver_nudged = ride.driver_deadline - now < NUDGE_BEFORE + timedelta(hours=1)


def driver_found(ride: Ride) -> None:
    ride.needs_driver = False
    ride.driver_deadline = None
    ride.driver_nudged = False
