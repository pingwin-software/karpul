"""The driver (or an admin) gives the car to a passenger in it
(POST /api/rides/{id}/give): the passenger drives, the old driver takes
their seat."""

from datetime import date, timedelta

from tests.test_takeover import ANA, BOB, CID, car, ride_with, sent, uid  # noqa: F401 - fixtures

TODAY = date.today()


def car_with(client, car, *names, **overrides):  # noqa: F811
    ride = ride_with(client, car, *names, **overrides)
    return client.get(f"/api/rides/{ride['id']}").json()


def bob_seat(ride):
    return next(b for b in ride["bookings"] if b["passenger_name"] == "Bob Jović")


def test_the_driver_gives_the_car_to_a_passenger_and_takes_their_seat(client, car, sent):  # noqa: F811
    ride = car_with(client, car, "Bob Jović", "Cid Ilić", day=TODAY)
    ana, bob, cid = uid(client, ANA), uid(client, BOB), uid(client, CID)
    seat = bob_seat(ride)
    sent.clear()

    res = client.post(f"/api/rides/{ride['id']}/give", json={"booking_id": seat["id"]}, headers=ANA)
    assert res.status_code == 200, res.text
    given = res.json()
    assert given["driver_id"] == bob and given["driver_name"] == "Bob Jović"
    names = sorted(b["passenger_name"] for b in given["bookings"])
    assert names == ["Ana Petrović", "Cid Ilić"]
    ana_seat = next(b for b in given["bookings"] if b["passenger_id"] == ana)
    assert ana_seat["pickup"] == seat["pickup"]
    assert given["free_seats"] == ride["free_seats"]
    assert sent == [("ride_given", [bob]), ("driver_found", [cid])]

    # Bob runs it now, Ana is a passenger who may get out.
    assert client.patch(f"/api/rides/{ride['id']}", json={"notes": "x"}, headers=BOB).status_code == 200
    assert client.patch(f"/api/rides/{ride['id']}", json={"notes": "y"}, headers=ANA).status_code == 403
    assert client.delete(f"/api/rides/{ride['id']}/bookings/{ana_seat['id']}", headers=ANA).status_code in (200, 204)


def test_only_the_driver_or_an_admin_gives_the_car_away(client, car, admin_auth):  # noqa: F811
    ride = car_with(client, car, "Bob Jović", "Cid Ilić", day=TODAY + timedelta(days=3))
    seat = bob_seat(ride)
    url = f"/api/rides/{ride['id']}/give"
    assert client.post(url, json={"booking_id": seat["id"]}, headers=CID).status_code == 403
    assert client.post(url, json={"booking_id": seat["id"]}, headers=BOB).status_code == 403
    assert client.post(url, json={"booking_id": 99999}, headers=ANA).status_code == 404

    res = client.post(url, json={"booking_id": seat["id"]}, headers=admin_auth)
    assert res.status_code == 200, res.text
    assert res.json()["driver_name"] == "Bob Jović"
    log = client.get("/api/admin/log", headers=admin_auth).json()
    assert any(line["action"] == "car_given" for line in log)


def test_an_own_car_is_not_given_away(client):
    ride = client.post(
        "/api/rides",
        json={
            "ride_date": TODAY.isoformat(),
            "car_type": "own",
            "car_name": "Blue Golf",
            "driver_name": "Ana Petrović",
            "origin": "Novi Sad",
            "destination": "Beograd",
            "departure_time": "08:00",
            "seats": 2,
        },
        headers=ANA,
    ).json()
    client.post(f"/api/rides/{ride['id']}/bookings", json={"passenger_name": "Bob Jović"})
    seat = bob_seat(client.get(f"/api/rides/{ride['id']}").json())
    assert client.post(f"/api/rides/{ride['id']}/give", json={"booking_id": seat["id"]}, headers=ANA).status_code == 409


def test_a_ride_whose_driver_cancelled_is_not_given_away(client, car):  # noqa: F811
    ride = car_with(client, car, "Bob Jović", "Cid Ilić", day=TODAY + timedelta(days=3))
    seat = bob_seat(ride)
    client.delete(f"/api/rides/{ride['id']}", headers=ANA)
    # Ana gave it up: she runs it no more, and Bob takes it over his own way.
    assert client.post(f"/api/rides/{ride['id']}/give", json={"booking_id": seat["id"]}, headers=ANA).status_code == 403
