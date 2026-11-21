"""Passkeys: signing in with the phone's fingerprint or face instead of a
password (WebAuthn), for an app with no email to send a reset to.

Done on the `cryptography` package the push code already needs, with no
WebAuthn library, for the reason `app/webpush.py` gives. That stays small
because of two choices:

* No attestation. Karpul does not care who made the authenticator, only that
  the same one comes back, so the browser is asked for `attestation: "none"`
  and hands over what it has already parsed: the authenticator data and the
  public key as SubjectPublicKeyInfo (`getPublicKey()`). Nothing here reads
  CBOR. The key is taken on trust the first time, which is all "none" ever
  gives: whoever registers it is signed in, and it only ever opens their own
  account.
* Discoverable credentials only. Signing in sends no username: the
  authenticator offers the passkeys it holds for this site, and the
  credential id says whose it is.

A sign-in is the authenticator's signature over its own data and the hash of
what the browser says it was asked (`clientDataJSON`: our challenge, the page's
origin). The checks, in `verify_*`: the challenge is one we issued, for this
purpose, minutes ago, and is spent by the look; the origin is this site; the
data is for this site (`rpIdHash`); a person was there and proved it was them
(the UP and UV flags); the signature holds under the stored key; and the
authenticator's counter, when it keeps one, went up.

The challenges live in this process, like the throttles (`app/ratelimit.py`):
Karpul is one worker, and a challenge lost to a restart is a button tapped
again.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, padding, rsa
from cryptography.hazmat.primitives.serialization import load_der_public_key

CHALLENGE_BYTES = 32
CHALLENGE_TTL_S = 5 * 60
# One per device is the idea; ten is a drawer full of old phones.
MAX_PASSKEYS = 10
# COSE algorithm numbers offered to the authenticator, best first: ES256
# (every phone and security key), EdDSA, RS256 (Windows Hello).
ALGORITHMS = (-7, -8, -257)
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "[::1]"})

FLAG_USER_PRESENT = 0x01
FLAG_USER_VERIFIED = 0x04
FLAG_ATTESTED = 0x40


class PasskeyError(ValueError):
    """What was sent does not hold up. The message is for the log and the
    tests; the person only hears that it did not work."""


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64u(text: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except (binascii.Error, ValueError) as exc:
        raise PasskeyError("not base64url") from exc


# --- challenges ----------------------------------------------------------------


class Challenges:
    """The challenges handed out and not yet answered: each is for one purpose
    ("register" for one account, "login" for whoever comes), lives five
    minutes and is good once."""

    def __init__(self) -> None:
        self._live: dict[str, tuple[str, int | None, float]] = {}
        self._lock = threading.Lock()

    def issue(self, purpose: str, user_id: int | None = None) -> str:
        challenge = b64u(secrets.token_bytes(CHALLENGE_BYTES))
        now = time.monotonic()
        with self._lock:
            for old in [c for c, (_, _, until) in self._live.items() if until <= now]:
                del self._live[old]
            self._live[challenge] = (purpose, user_id, now + CHALLENGE_TTL_S)
        return challenge

    def spend(self, challenge: str, purpose: str, user_id: int | None = None) -> bool:
        with self._lock:
            found = self._live.pop(challenge, None)
        if found is None:
            return False
        was_for, whose, until = found
        return was_for == purpose and whose == user_id and until > time.monotonic()

    def clear(self) -> None:
        with self._lock:
            self._live.clear()


challenges = Challenges()


# --- which site this is ----------------------------------------------------------


def rp_id(host: str) -> str:
    """The name the passkeys are bound to: `KARPUL_RP_ID` when set (a parent
    domain, to cover both `karpul.dev` and `www.`), else the host the request
    came to, without its port."""
    configured = os.getenv("KARPUL_RP_ID", "").strip().lower()
    if configured:
        return configured
    return (urlsplit(f"//{host}").hostname or "").lower()


def origin_ok(origin: str, rp: str) -> bool:
    """The page that asked the authenticator is this site: its host is the
    relying party's (or under it), over https, or plain http on this machine."""
    parts = urlsplit(origin)
    host = (parts.hostname or "").lower()
    if not host or not rp:
        return False
    if host != rp and not host.endswith("." + rp):
        return False
    return parts.scheme == "https" or (parts.scheme == "http" and host in LOCAL_HOSTS)


# --- what the authenticator says ---------------------------------------------------


@dataclass(frozen=True)
class AuthData:
    rp_hash: bytes
    flags: int
    sign_count: int
    # Only on a registration (the attested credential data).
    credential_id: bytes | None


def parse_auth_data(raw: bytes) -> AuthData:
    if len(raw) < 37:
        raise PasskeyError("authenticator data too short")
    flags = raw[32]
    credential_id = None
    if flags & FLAG_ATTESTED:
        if len(raw) < 55:
            raise PasskeyError("attested data too short")
        length = int.from_bytes(raw[53:55], "big")
        credential_id = raw[55 : 55 + length]
        if len(credential_id) != length or not length:
            raise PasskeyError("credential id cut short")
    return AuthData(raw[:32], flags, int.from_bytes(raw[33:37], "big"), credential_id)


def _client_data(raw: bytes, kind: str, purpose: str, user_id: int | None, rp: str) -> None:
    try:
        data = json.loads(raw)
    except ValueError as exc:
        raise PasskeyError("client data is not JSON") from exc
    if not isinstance(data, dict) or data.get("type") != kind:
        raise PasskeyError("wrong ceremony")
    challenge = data.get("challenge")
    if not isinstance(challenge, str) or not challenges.spend(challenge, purpose, user_id):
        raise PasskeyError("unknown, spent or expired challenge")
    if not origin_ok(str(data.get("origin", "")), rp):
        raise PasskeyError("wrong origin")


def _checked_auth_data(raw: bytes, rp: str) -> AuthData:
    data = parse_auth_data(raw)
    if not secrets.compare_digest(data.rp_hash, hashlib.sha256(rp.encode()).digest()):
        raise PasskeyError("for another site")
    if not data.flags & FLAG_USER_PRESENT or not data.flags & FLAG_USER_VERIFIED:
        raise PasskeyError("nobody proved it was them")
    return data


def load_key(spki: bytes):
    """The public key, held to the kinds asked for (`ALGORITHMS`)."""
    try:
        key = load_der_public_key(spki)
    except (ValueError, TypeError) as exc:
        raise PasskeyError("not a public key") from exc
    if isinstance(key, ec.EllipticCurvePublicKey):
        if not isinstance(key.curve, ec.SECP256R1):
            raise PasskeyError("not a P-256 key")
    elif isinstance(key, rsa.RSAPublicKey):
        if key.key_size < 2048:
            raise PasskeyError("RSA key too short")
    elif not isinstance(key, ed25519.Ed25519PublicKey):
        raise PasskeyError("unsupported kind of key")
    return key


def verify_registration(
    *, credential_id: str, client_data: str, authenticator_data: str, public_key: str, user_id: int, host: str
) -> int:
    """A new passkey checks out; returns the authenticator's counter. Raises
    PasskeyError otherwise."""
    rp = rp_id(host)
    _client_data(unb64u(client_data), "webauthn.create", "register", user_id, rp)
    data = _checked_auth_data(unb64u(authenticator_data), rp)
    if data.credential_id is None or data.credential_id != unb64u(credential_id):
        raise PasskeyError("the credential is not the one in the authenticator data")
    load_key(unb64u(public_key))
    return data.sign_count


def verify_assertion(
    *, client_data: str, authenticator_data: str, signature: str, public_key: str, sign_count: int, host: str
) -> int:
    """A sign-in with a stored passkey checks out; returns the new counter.
    Raises PasskeyError otherwise."""
    rp = rp_id(host)
    client_raw, auth_raw = unb64u(client_data), unb64u(authenticator_data)
    _client_data(client_raw, "webauthn.get", "login", None, rp)
    data = _checked_auth_data(auth_raw, rp)
    key = load_key(unb64u(public_key))
    signed = auth_raw + hashlib.sha256(client_raw).digest()
    sig = unb64u(signature)
    try:
        if isinstance(key, ec.EllipticCurvePublicKey):
            key.verify(sig, signed, ec.ECDSA(hashes.SHA256()))
        elif isinstance(key, rsa.RSAPublicKey):
            key.verify(sig, signed, padding.PKCS1v15(), hashes.SHA256())
        else:
            key.verify(sig, signed)
    except InvalidSignature as exc:
        raise PasskeyError("bad signature") from exc
    # A counter that does not move forward is a copied authenticator. The
    # passkeys that sync between a person's devices keep none (always 0).
    if (data.sign_count or sign_count) and data.sign_count <= sign_count:
        raise PasskeyError("the counter went backwards")
    return data.sign_count


def creation_options(*, host: str, user_id: int, username: str, display_name: str, existing: list[str]) -> dict:
    """What `navigator.credentials.create` is called with, binary as base64url."""
    return {
        "challenge": challenges.issue("register", user_id),
        "rp": {"id": rp_id(host), "name": "Karpul"},
        "user": {"id": b64u(str(user_id).encode()), "name": username, "displayName": display_name},
        "pubKeyCredParams": [{"type": "public-key", "alg": alg} for alg in ALGORITHMS],
        "timeout": CHALLENGE_TTL_S * 1000,
        "attestation": "none",
        "authenticatorSelection": {"residentKey": "required", "requireResidentKey": True, "userVerification": "required"},
        # The same authenticator is not asked to hold a second one.
        "excludeCredentials": [{"type": "public-key", "id": cid} for cid in existing],
    }


def request_options(*, host: str) -> dict:
    """What `navigator.credentials.get` is called with: no list of
    credentials, so the authenticator offers the ones it holds for this site."""
    return {
        "challenge": challenges.issue("login"),
        "rpId": rp_id(host),
        "timeout": CHALLENGE_TTL_S * 1000,
        "userVerification": "required",
    }
