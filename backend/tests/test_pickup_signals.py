"""On the day: a passenger says "I'm at the pickup point", and the driver says
afterwards who did not turn up (routers/seats.py)."""

from datetime import date, datetime, timedelta

import pytest

from app import services
from app.models import Booking, Ride
from tests.conftest import patch_ride_notify


def own_ride(**overrides):
    base = {
        "car_type": "own",
        "car_name": "Blue Golf",
        "origin": "Novi Sad",
        "destination": "HQ",
        "seats": 2,
    }
    base.update(overrides)
    return base




@pytest.fixture
def pushes(monkeypatch):
    sent: list[tuple] = []
    patch_ride_notify(monkeypatch, lambda session, ids, kind, ride=None, **kw: sent.append((kind, list(ids), kw)))
    return sent


def _ride(client, *, day=None, departure="08:00", **kw):
    day = day or date.today().isoformat()
    ride = client.post("/api/rides", json=own_ride(ride_date=day, driver_name="Dana", departure_time=departure, **kw)).json()
    ride = client.post(f"/api/rides/{ride['id']}/bookings", json={"passenger_name": "Pavle"}).json()
    return ride, ride["bookings"][0]


def test_here_is_shown_to_the_car_and_pushed_to_the_driver(client, pushes):
    ride, seat = _ride(client, stops=["Bulevar 12"])
    assert seat["here_at"] is None and seat["no_show"] is False
    client.patch(f"/api/rides/{ride['id']}/bookings/{seat['id']}", json={"pickup": "Bulevar 12"}, headers={"X-User-Name": "Pavle"})
    pushes.clear()

    r = client.post(f"/api/rides/{ride['id']}/bookings/{seat['id']}/here", headers={"X-User-Name": "Pavle"})
    assert r.status_code == 200, r.text
    assert r.json()["bookings"][0]["here_at"] is not None
    assert [(kind, kw) for kind, _, kw in pushes] == [("passenger_here", {"name": "Pavle", "place": "Bulevar 12"})]

    # A second tap says nothing new and pushes nobody.
    pushes.clear()
    assert client.post(f"/api/rides/{ride['id']}/bookings/{seat['id']}/here", headers={"X-User-Name": "Pavle"}).status_code == 200
    assert pushes == []

    # Another place: nobody is standing there yet.
    moved = client.patch(f"/api/rides/{ride['id']}/bookings/{seat['id']}", json={"pickup": ""}, headers={"X-User-Name": "Pavle"}).json()
    assert moved["bookings"][0]["here_at"] is None


def test_here_can_be_taken_back(client, pushes):
    ride, seat = _ride(client)
    path = f"/api/rides/{ride['id']}/bookings/{seat['id']}/here"
    client.post(path, headers={"X-User-Name": "Pavle"})
    pushes.clear()
    back = client.delete(path, headers={"X-User-Name": "Pavle"})
    assert back.status_code == 200 and back.json()["bookings"][0]["here_at"] is None
    assert pushes == []


def test_only_the_passenger_and_only_on_the_day(client):
    ride, seat = _ride(client)
    path = f"/api/rides/{ride['id']}/bookings/{seat['id']}/here"
    by_driver = client.post(path, headers={"X-User-Name": "Dana"})
    assert by_driver.status_code == 403
    assert by_driver.json()["detail"] == "Only the passenger can say they are at the pickup point"
    assert client.delete(path, headers={"X-User-Name": "Dana"}).status_code == 403

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    later, later_seat = _ride(client, day=tomorrow)
    early = client.post(f"/api/rides/{later['id']}/bookings/{later_seat['id']}/here", headers={"X-User-Name": "Pavle"})
    assert early.status_code == 409
    assert early.json()["detail"] == "You can only be at the pickup point on the day of the ride"
    assert client.post(f"/api/rides/{ride['id']}/bookings/99999/here", headers={"X-User-Name": "Pavle"}).status_code == 404


def test_here_is_throttled(client):
    ride, seat = _ride(client)
    path = f"/api/rides/{ride['id']}/bookings/{seat['id']}/here"
    for _ in range(6):
        assert client.post(path, headers={"X-User-Name": "Pavle"}).status_code == 200
        client.delete(path, headers={"X-User-Name": "Pavle"})
    assert client.post(path, headers={"X-User-Name": "Pavle"}).status_code == 429


def _left(session_factory, ride_id):
    """Put the ride in the past: it left yesterday."""
    with session_factory() as session:
        row = session.get(Ride, ride_id)
        row.ride_date = date.today() - timedelta(days=1)
        session.add(row)
        session.commit()


def test_no_show_only_after_the_ride_left_and_only_by_who_runs_it(client, session_factory, pushes):
    soon = (datetime.now() + timedelta(hours=1))
    if soon.date() != date.today():
        pytest.skip("too close to midnight for a ride later today")
    ride, seat = _ride(client, departure=soon.strftime("%H:%M"))
    path = f"/api/rides/{ride['id']}/bookings/{seat['id']}/no-show"
    early = client.put(path, json={"no_show": True}, headers={"X-User-Name": "Dana"})
    assert early.status_code == 409 and early.json()["detail"] == "This ride has not left yet"

    _left(session_factory, ride["id"])
    by_passenger = client.put(path, json={"no_show": True}, headers={"X-User-Name": "Pavle"})
    assert by_passenger.status_code == 403
    assert by_passenger.json()["detail"] == "Only the driver or an admin can say who did not turn up"

    pushes.clear()
    marked = client.put(path, json={"no_show": True}, headers={"X-User-Name": "Dana"})
    assert marked.status_code == 200 and marked.json()["bookings"][0]["no_show"] is True
    assert [(kind, kw) for kind, _, kw in pushes] == [("no_show", {"driver": "Dana"})]

    # Taking it back tells nobody.
    pushes.clear()
    back = client.put(path, json={"no_show": False}, headers={"X-User-Name": "Dana"})
    assert back.json()["bookings"][0]["no_show"] is False and pushes == []


def test_a_no_show_is_no_shared_trip(client, session_factory):
    ride, seat = _ride(client, distance_km=40)
    _left(session_factory, ride["id"])
    with session_factory() as session:
        row = session.get(Ride, ride["id"])
        assert services.impact([row])["car_km_avoided"] == 40
        assert services.impact([row], seat["passenger_id"])["car_km_avoided"] == 20

    client.put(f"/api/rides/{ride['id']}/bookings/{seat['id']}/no-show", json={"no_show": True}, headers={"X-User-Name": "Dana"})
    with session_factory() as session:
        row = session.get(Ride, ride["id"])
        assert services.impact([row])["car_km_avoided"] == 0
        assert services.impact([row], row.driver_id)["car_km_avoided"] == 0
    mine = client.get("/api/stats/me", headers={"X-User-Name": "Pavle"}).json()
    assert mine["all"]["rides_ridden"] == 0 and mine["history"] == []
    drivers = client.get("/api/stats/me", headers={"X-User-Name": "Dana"}).json()
    assert drivers["all"]["rides_driven"] == 1 and drivers["all"]["people_carried"] == 0


def test_moving_the_ride_clears_here(client, session_factory):
    ride, seat = _ride(client)
    client.post(f"/api/rides/{ride['id']}/bookings/{seat['id']}/here", headers={"X-User-Name": "Pavle"})
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    # Another day waits for the passenger's yes.
    asked = client.patch(f"/api/rides/{ride['id']}", json={"ride_date": tomorrow}, headers={"X-User-Name": "Dana"}).json()
    if asked.get("proposal"):
        client.post(f"/api/rides/{ride['id']}/proposal/agree", headers={"X-User-Name": "Pavle"})
    with session_factory() as session:
        assert str(session.get(Ride, ride["id"]).ride_date) == tomorrow
        assert session.get(Booking, seat["id"]).here_at is None
