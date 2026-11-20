"""A "forgot password" ask from the sign-in screen: an admin approves it under
Approvals and the asking browser gets a one-time reset link
(routers/auth.ask_for_reset, routers/admin.approve_reset)."""

from datetime import timedelta

from sqlmodel import select

from app.models import AdminAction, ResetRequest
from tests.test_auth import ANA, bearer, register


def ask(client, username="ana"):
    r = client.anon.post("/api/auth/reset-requests", json={"username": username})
    assert r.status_code == 201, r.text
    return r.json()


def status_of(client, claim):
    return client.anon.post("/api/auth/reset-requests/status", json={"claim": claim})


def test_an_approved_ask_hands_the_browser_a_reset_link(client, admin_auth, monkeypatch):
    told = []
    monkeypatch.setattr("app.routers.auth.notify", lambda s, ids, kind, **kw: told.append((ids, kind, kw)))
    ana = register(client)
    mine = ask(client, " ANA ")
    assert len(mine["code"]) == 4 and mine["code"].isdigit()
    assert told and told[0][1] == "reset_requested" and told[0][2]["name"] == "Ana Petrović"
    assert status_of(client, mine["claim"]).json() == {"status": "pending", "token": None}

    waiting = client.get("/api/admin/reset-requests", headers=admin_auth).json()
    assert [(w["username"], w["display_name"], w["code"]) for w in waiting] == [("ana", "Ana Petrović", mine["code"])]
    # Not for anyone but an admin.
    assert client.get("/api/admin/reset-requests", headers=bearer(ana["token"])).status_code == 403

    r = client.post(f"/api/admin/reset-requests/{waiting[0]['id']}/approve", headers=admin_auth)
    assert r.status_code == 204, r.text
    assert client.get("/api/admin/reset-requests", headers=admin_auth).json() == []

    answer = status_of(client, mine["claim"]).json()
    assert answer["status"] == "approved" and answer["token"]
    # The link is the ordinary one: it sets the password and signs in.
    r = client.anon.post("/api/auth/reset", json={"token": answer["token"], "new_password": "a-whole-new-one"})
    assert r.status_code == 200, r.text
    assert client.post("/api/auth/login", json={"login": "ana", "password": ANA["password"]}).status_code == 401
    # The ask is spent: a second look finds nothing.
    assert status_of(client, mine["claim"]).status_code == 404


def test_a_declined_ask_says_so_once(client, admin_auth, session_factory):
    register(client)
    mine = ask(client)
    ask_id = client.get("/api/admin/reset-requests", headers=admin_auth).json()[0]["id"]
    assert client.post(f"/api/admin/reset-requests/{ask_id}/decline", headers=admin_auth).status_code == 204
    # Decided already.
    assert client.post(f"/api/admin/reset-requests/{ask_id}/approve", headers=admin_auth).status_code == 404
    assert status_of(client, mine["claim"]).json() == {"status": "declined", "token": None}
    assert status_of(client, mine["claim"]).status_code == 404
    with session_factory() as s:
        assert [a.action for a in s.exec(select(AdminAction))] == ["reset_declined"]


def test_a_new_ask_replaces_the_old_one_and_can_be_withdrawn(client, admin_auth):
    register(client)
    first = ask(client)
    second = ask(client)
    assert status_of(client, first["claim"]).status_code == 404
    assert len(client.get("/api/admin/reset-requests", headers=admin_auth).json()) == 1
    r = client.anon.post("/api/auth/reset-requests/withdraw", json={"claim": second["claim"]})
    assert r.status_code == 204
    assert client.get("/api/admin/reset-requests", headers=admin_auth).json() == []


def test_unknown_and_switched_off_accounts_and_too_many_asks(client, admin_auth):
    assert client.anon.post("/api/auth/reset-requests", json={"username": "nobody"}).status_code == 404
    ana = register(client)
    for _ in range(3):
        ask(client)
    assert client.anon.post("/api/auth/reset-requests", json={"username": "ana"}).status_code == 429
    client.patch(f"/api/admin/users/{ana['user']['id']}", json={"disabled": True}, headers=admin_auth)
    from app import ratelimit

    ratelimit.reset_all()
    assert client.anon.post("/api/auth/reset-requests", json={"username": "ana"}).status_code == 403


def test_an_ask_expires_after_a_day(client, admin_auth, session_factory):
    register(client)
    mine = ask(client)
    with session_factory() as s:
        row = s.exec(select(ResetRequest)).one()
        row.created_at = row.created_at - timedelta(hours=25)
        s.add(row)
        s.commit()
    assert client.get("/api/admin/reset-requests", headers=admin_auth).json() == []
    assert status_of(client, mine["claim"]).status_code == 404
