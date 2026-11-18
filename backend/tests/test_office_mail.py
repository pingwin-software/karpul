"""The mail to the office about a shared car is on record: who said it went
out, when an edit makes it stale, and the approval push that asks for it."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import text
from sqlmodel import Session, SQLModel

from app.database import add_missing_columns, make_engine
from app.models import CarType, Ride
from app.push import ride_message
from tests.test_shared_car_share import MONDAY, cars, sent, shared  # noqa: F401 - fixtures


def mail(client, ride_id, who="Ana Petrović", **body):
    return client.post(f"/api/rides/{ride_id}/office-mail", json=body, headers={"X-User-Name": who})


def test_a_new_shared_car_has_not_told_the_office_until_the_driver_says_so(client, cars):  # noqa: F811
    ride = client.post("/api/rides", json=shared(cars[0]["id"])).json()
    assert ride["office_mailed_at"] is None

    # Only whoever runs the ride says so.
    assert mail(client, ride["id"], who="Mila Ilić").status_code == 403
    first = mail(client, ride["id"])
    assert first.status_code == 200, first.text
    stamp = first.json()["office_mailed_at"]
    assert stamp is not None
    # Saying it again keeps the first time.
    assert mail(client, ride["id"]).json()["office_mailed_at"] == stamp
    assert client.get(f"/api/rides/{ride['id']}").json()["office_mailed_at"] == stamp


def test_own_cars_and_pending_rides_have_no_mail(client, cars):  # noqa: F811
    own = client.post("/api/rides", json=shared(None, car_type="own", car_name="Blue Golf")).json()
    res = mail(client, own["id"])
    assert res.status_code == 409
    assert res.json()["detail"] == "Only a shared car's ride goes to the office"

    client.post("/api/rides", json=shared(cars[0]["id"]))
    pending = client.post("/api/rides", json=shared(cars[1]["id"], MONDAY + timedelta(days=2), request_approval=True)).json()
    assert pending["approval"] == "pending"
    res = mail(client, pending["id"])
    assert res.status_code == 409
    assert res.json()["detail"] == "This ride is not approved yet"


def test_one_mail_covers_a_weekly_series_when_it_said_so(client, cars):  # noqa: F811
    until = (MONDAY + timedelta(days=14)).isoformat()
    first = client.post("/api/rides", json=shared(cars[0]["id"], repeat_until=until)).json()
    series = [r for r in client.get("/api/rides", params={"from": MONDAY.isoformat(), "to": until}).json() if r["series_id"] == first["series_id"]]
    assert len(series) == 3
    assert mail(client, first["id"], series=True).status_code == 200
    after = [client.get(f"/api/rides/{r['id']}").json()["office_mailed_at"] for r in series]
    assert all(after)

    # Without the flag only the one ride is marked.
    other = client.post("/api/rides", json=shared(cars[1]["id"], MONDAY + timedelta(days=21), repeat_until=(MONDAY + timedelta(days=28)).isoformat()))
    assert other.status_code == 201, other.text
    mail(client, other.json()["id"])
    later = [r for r in client.get("/api/rides", params={"from": (MONDAY + timedelta(days=28)).isoformat(), "to": (MONDAY + timedelta(days=28)).isoformat()}).json()]
    assert [r["office_mailed_at"] for r in later] == [None]


def test_moving_the_car_day_or_time_asks_for_a_new_mail_but_a_note_does_not(client, cars):  # noqa: F811
    ride = client.post("/api/rides", json=shared(cars[0]["id"])).json()
    mail(client, ride["id"])
    headers = {"X-User-Name": "Ana Petrović"}
    noted = client.patch(f"/api/rides/{ride['id']}", json={"notes": "Bring the charger"}, headers=headers)
    assert noted.json()["office_mailed_at"] is not None
    moved = client.patch(f"/api/rides/{ride['id']}", json={"return_time": "15:00"}, headers=headers)
    assert moved.status_code == 200, moved.text
    assert moved.json()["office_mailed_at"] is None


def test_approval_push_names_the_car_and_opens_the_mail(client, cars, admin_auth, sent):  # noqa: F811
    client.post("/api/rides", json=shared(cars[0]["id"]))
    pending = client.post("/api/rides", json=shared(cars[1]["id"], MONDAY + timedelta(days=2), request_approval=True)).json()
    sent.clear()
    assert client.post(f"/api/rides/{pending['id']}/approve", headers=admin_auth).status_code == 200
    assert [kind for kind, _, _ in sent] == ["ride_approved"]

    ride = Ride(
        id=7,
        ride_date=date(2026, 11, 18),
        car_type=CarType.corporate,
        car_name="Mazda 6e (BG-123-AA)",
        driver_name="Ana Petrović",
        origin="Novi Sad",
        destination="Beograd",
        departure_time=time(8, 0),
        return_time=time(17, 30),
        seats=3,
    )
    en = ride_message("ride_approved", ride, "en", name="Ada Admin")
    assert en["title"] == "Ada Admin approved your shared car. Send the office the mail"
    assert en["body"] == "Mazda 6e (BG-123-AA): Wed 18 Nov 08:00, Novi Sad to Beograd, back 17:30"
    assert en["url"] == "/ride/7?mail=1"
    sr = ride_message("ride_approved", ride, "sr", name="Ada Admin")
    assert sr["body"] == "Mazda 6e (BG-123-AA): sre 18. nov 08:00, Novi Sad do Beograd, povratak 17:30"


def test_the_column_arrives_with_the_old_shared_cars_counted_as_told(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'old.db'}")
    SQLModel.metadata.create_all(engine)
    made = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
    with Session(engine) as session:
        for car_type in (CarType.corporate, CarType.own):
            session.add(
                Ride(
                    ride_date=date(2026, 11, 2),
                    car_type=car_type,
                    car_name="X",
                    driver_name="Ana",
                    origin="A",
                    destination="B",
                    departure_time=time(8, 0),
                    seats=2,
                    created_at=made,
                )
            )
        session.commit()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE ride DROP COLUMN office_mailed_at"))
    assert "ride.office_mailed_at" in add_missing_columns(engine)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT car_type, office_mailed_at FROM ride ORDER BY id")).all()
    assert [(t, v is not None and v.startswith("2026-11-01 09:00")) for t, v in rows] == [("corporate", True), ("own", False)]
