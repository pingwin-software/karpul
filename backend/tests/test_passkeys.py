"""Passkeys (app/passkeys.py, routers/auth.py), against a software
authenticator: a P-256 key that signs what a phone would."""

import hashlib
import json
import os

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from app import passkeys
from app.passkeys import b64u

HOST = "testserver"
ORIGIN = f"https://{HOST}"
UP, UV, AT = 0x01, 0x04, 0x40


class Authenticator:
    """One credential on one device."""

    def __init__(self, *, counts: bool = False, key=None):
        self.key = key or ec.generate_private_key(ec.SECP256R1())
        self.credential_id = os.urandom(20)
        self.count = 0
        self.counts = counts

    @property
    def spki(self) -> str:
        return b64u(self.key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo))

    def _auth_data(self, rp: str, flags: int, attested: bool) -> bytes:
        if self.counts:
            self.count += 1
        data = hashlib.sha256(rp.encode()).digest() + bytes([flags | (AT if attested else 0)]) + self.count.to_bytes(4, "big")
        if attested:
            # aaguid, the id's length, the id; the COSE key that follows is not read.
            data += bytes(16) + len(self.credential_id).to_bytes(2, "big") + self.credential_id + b"\xa0"
        return data

    @staticmethod
    def _client(kind: str, challenge: str, origin: str) -> bytes:
        return json.dumps({"type": kind, "challenge": challenge, "origin": origin, "crossOrigin": False}).encode()

    def create(self, options: dict, *, origin: str = ORIGIN, flags: int = UP | UV, name: str = "Pixel") -> dict:
        return {
            "id": b64u(self.credential_id),
            "client_data": b64u(self._client("webauthn.create", options["challenge"], origin)),
            "authenticator_data": b64u(self._auth_data(options["rp"]["id"], flags, True)),
            "public_key": self.spki,
            "name": name,
        }

    def get(self, options: dict, *, origin: str = ORIGIN, flags: int = UP | UV, kind: str = "webauthn.get") -> dict:
        client = self._client(kind, options["challenge"], origin)
        auth = self._auth_data(options["rpId"], flags, False)
        signed = auth + hashlib.sha256(client).digest()
        if isinstance(self.key, rsa.RSAPrivateKey):
            from cryptography.hazmat.primitives.asymmetric import padding

            signature = self.key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
        else:
            signature = self.key.sign(signed, ec.ECDSA(hashes.SHA256()))
        return {
            "id": b64u(self.credential_id),
            "client_data": b64u(client),
            "authenticator_data": b64u(auth),
            "signature": b64u(signature),
        }


@pytest.fixture(autouse=True)
def fresh_challenges(monkeypatch):
    monkeypatch.delenv("KARPUL_RP_ID", raising=False)
    passkeys.challenges.clear()


def _add(client, device: Authenticator, who: str = "Ana Anic", **kw):
    options = client.post("/api/auth/passkeys/options", headers=client.auth(who)).json()
    return client.post("/api/auth/passkeys", json=device.create(options, **kw), headers=client.auth(who))


def _sign_in(client, device: Authenticator, **kw):
    options = client.anon.post("/api/auth/passkey-login/options").json()
    return client.anon.post("/api/auth/passkey-login", json=device.get(options, **kw))


def test_a_passkey_is_added_listed_and_signs_in(client):
    device = Authenticator()
    options = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic")).json()
    assert options["rp"] == {"id": HOST, "name": "Karpul"}
    assert options["attestation"] == "none"
    assert options["authenticatorSelection"]["residentKey"] == "required"
    assert options["authenticatorSelection"]["userVerification"] == "required"
    added = client.post("/api/auth/passkeys", json=device.create(options), headers=client.auth("Ana Anic"))
    assert added.status_code == 201, added.text
    assert added.json()["name"] == "Pixel" and added.json()["last_used_at"] is None
    assert "public_key" not in added.json()

    listed = client.get("/api/auth/passkeys", headers=client.auth("Ana Anic")).json()
    assert [p["name"] for p in listed] == ["Pixel"]
    # Nobody else's list has it.
    assert client.get("/api/auth/passkeys", headers=client.auth("Bora Boric")).json() == []

    login_options = client.anon.post("/api/auth/passkey-login/options").json()
    assert login_options["rpId"] == HOST and "allowCredentials" not in login_options
    signed_in = client.anon.post("/api/auth/passkey-login", json=device.get(login_options))
    assert signed_in.status_code == 200, signed_in.text
    body = signed_in.json()
    assert body["user"]["display_name"] == "Ana Anic"
    me = client.anon.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert client.get("/api/auth/passkeys", headers=client.auth("Ana Anic")).json()[0]["last_used_at"] is not None


def test_the_next_options_exclude_what_the_account_has(client):
    device = Authenticator()
    assert _add(client, device).status_code == 201
    options = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic")).json()
    assert options["excludeCredentials"] == [{"type": "public-key", "id": b64u(device.credential_id)}]


def test_an_rsa_passkey_works_too(client):
    device = Authenticator(key=rsa.generate_private_key(public_exponent=65537, key_size=2048))
    assert _add(client, device).status_code == 201
    assert _sign_in(client, device).status_code == 200


def test_a_challenge_is_good_once_and_only_for_its_purpose(client):
    device = Authenticator()
    options = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic")).json()
    sent = device.create(options)
    assert client.post("/api/auth/passkeys", json=sent, headers=client.auth("Ana Anic")).status_code == 201
    # The same answer again: the challenge is spent.
    again = client.post("/api/auth/passkeys", json=sent, headers=client.auth("Ana Anic"))
    assert again.status_code == 400 and again.json()["detail"] == "That passkey could not be added; try again"

    # A registration challenge of one account is no use to another.
    other = Authenticator()
    options = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic")).json()
    assert client.post("/api/auth/passkeys", json=other.create(options), headers=client.auth("Bora Boric")).status_code == 400

    # A sign-in answer replayed is refused.
    login_options = client.anon.post("/api/auth/passkey-login/options").json()
    answer = device.get(login_options)
    assert client.anon.post("/api/auth/passkey-login", json=answer).status_code == 200
    replay = client.anon.post("/api/auth/passkey-login", json=answer)
    assert replay.status_code == 401
    assert replay.json()["detail"] == "That passkey did not work here; sign in with your password"

    # A registration challenge does not sign anyone in.
    options = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic")).json()
    assert client.anon.post("/api/auth/passkey-login", json=device.get({"challenge": options["challenge"], "rpId": HOST})).status_code == 401


@pytest.mark.parametrize(
    "how",
    [
        {"origin": "https://evil.example"},
        {"origin": f"http://{HOST}"},
        {"flags": UP},
        {"flags": UV},
    ],
)
def test_a_registration_from_elsewhere_or_unverified_is_refused(client, how):
    assert _add(client, Authenticator(), **how).status_code == 400


@pytest.mark.parametrize(
    "how",
    [
        {"origin": "https://evil.example"},
        {"flags": UP},
        {"kind": "webauthn.create"},
    ],
)
def test_a_sign_in_from_elsewhere_or_unverified_is_refused(client, how):
    device = Authenticator()
    assert _add(client, device).status_code == 201
    assert _sign_in(client, device, **how).status_code == 401
    assert _sign_in(client, device).status_code == 200


def test_another_site_s_data_and_a_wrong_key_are_refused(client):
    device = Authenticator()
    assert _add(client, device).status_code == 201
    options = client.anon.post("/api/auth/passkey-login/options").json()
    assert client.anon.post("/api/auth/passkey-login", json=device.get({**options, "rpId": "evil.example"})).status_code == 401

    # Someone who knows the credential id but holds another key.
    thief = Authenticator()
    thief.credential_id = device.credential_id
    assert _sign_in(client, thief).status_code == 401
    # And a credential nobody registered.
    assert _sign_in(client, Authenticator()).status_code == 401


def test_a_counter_that_does_not_move_is_a_copy(client):
    device = Authenticator(counts=True)
    assert _add(client, device).status_code == 201
    assert _sign_in(client, device).status_code == 200
    device.count -= 2
    assert _sign_in(client, device).status_code == 401
    device.count += 5
    assert _sign_in(client, device).status_code == 200


def test_a_credential_belongs_to_one_account(client):
    device = Authenticator()
    assert _add(client, device).status_code == 201
    twice = _add(client, device, who="Bora Boric")
    assert twice.status_code == 409 and twice.json()["detail"] == "That passkey is already added"


def test_removing_a_passkey_closes_that_door_only(client):
    phone, laptop = Authenticator(), Authenticator()
    first = _add(client, phone).json()
    assert _add(client, laptop, name="Laptop").status_code == 201
    # Not someone else's to remove.
    assert client.delete(f"/api/auth/passkeys/{first['id']}", headers=client.auth("Bora Boric")).status_code == 404
    assert client.delete(f"/api/auth/passkeys/{first['id']}", headers=client.auth("Ana Anic")).status_code == 204
    assert _sign_in(client, phone).status_code == 401
    assert _sign_in(client, laptop).status_code == 200


def test_ten_passkeys_at_most(client, monkeypatch):
    monkeypatch.setattr(passkeys, "MAX_PASSKEYS", 2)
    assert _add(client, Authenticator()).status_code == 201
    assert _add(client, Authenticator()).status_code == 201
    full = client.post("/api/auth/passkeys/options", headers=client.auth("Ana Anic"))
    assert full.status_code == 409
    assert full.json()["detail"] == "An account holds 2 passkeys at most; remove one first"


def test_an_account_switched_off_is_not_signed_in(client, session_factory):
    from sqlmodel import select

    from app.models import User

    device = Authenticator()
    assert _add(client, device).status_code == 201
    with session_factory() as session:
        user = session.exec(select(User).where(User.first_name == "Ana")).one()
        user.disabled = True
        session.add(user)
        session.commit()
    off = _sign_in(client, device)
    assert off.status_code == 403 and off.json()["detail"] == "This account is switched off. Ask an admin"


def test_signed_out_there_is_no_list_and_no_adding(client):
    assert client.anon.get("/api/auth/passkeys").status_code == 401
    assert client.anon.post("/api/auth/passkeys/options").status_code == 401


def test_failures_count_against_the_address(client):
    for _ in range(30):
        assert _sign_in(client, Authenticator()).status_code == 401
    assert client.anon.post("/api/auth/passkey-login/options").status_code == 429


def test_the_site_can_be_a_parent_domain(monkeypatch):
    monkeypatch.setenv("KARPUL_RP_ID", "karpul.dev")
    assert passkeys.rp_id("www.karpul.dev") == "karpul.dev"
    assert passkeys.origin_ok("https://www.karpul.dev", "karpul.dev")
    assert passkeys.origin_ok("https://karpul.dev", "karpul.dev")
    assert not passkeys.origin_ok("https://notkarpul.dev", "karpul.dev")
    assert not passkeys.origin_ok("http://www.karpul.dev", "karpul.dev")
    monkeypatch.delenv("KARPUL_RP_ID")
    assert passkeys.rp_id("localhost:8000") == "localhost"
    assert passkeys.origin_ok("http://localhost:5173", "localhost")


def test_deleting_an_account_takes_its_passkeys(client, admin_auth, session_factory):
    from sqlmodel import select

    from app.models import Passkey

    device = Authenticator()
    assert _add(client, device).status_code == 201
    people = client.get("/api/admin/users", headers=admin_auth).json()
    ana = next(p for p in people if p["display_name"] == "Ana Anic")
    assert client.delete(f"/api/admin/users/{ana['id']}", headers=admin_auth).status_code in (200, 204)
    with session_factory() as session:
        assert session.exec(select(Passkey)).all() == []
    assert _sign_in(client, device).status_code == 401
