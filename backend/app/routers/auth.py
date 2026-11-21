"""`/api/auth`: register, sign in, sign out, your own account, the
password reset links an admin hands out, and the "forgot password" asks that
an admin approves under Approvals (which end in such a link).

The browser keeps the token from `register` / `login` / `reset` and sends it
as `Authorization: Bearer <token>` on everything afterwards; `app/auth.py`
turns it back into the person acting. Nothing here ever returns a password hash.

The three doors (sign-in, registration, a reset link) are throttled in
`app/ratelimit.py`.
"""

import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, col, delete, select

from .. import passkeys, ratelimit
from ..admin import admin_ids, is_admin
from ..auth import (
    CredsDep,
    burn_password_time,
    end_other_sessions,
    end_session,
    hash_password,
    hash_token,
    issue_reset,
    renew_session,
    require_user,
    reset_ask_expired,
    reset_for_token,
    start_session,
    user_by_login,
    verify_password,
)
from ..database import get_session, get_write_session
from ..events import photos_changed, resets_changed, ride_saved
from ..models import Passkey, ProfilePhoto, ResetRequest, User, utcnow
from ..push import notify
from ..schemas import (
    AuthOut,
    LoginIn,
    PasskeyLoginIn,
    PasskeyRead,
    PasskeyRegisterIn,
    ProfileUpdate,
    RegisterIn,
    ResetAskIn,
    ResetAskOut,
    ResetAskStatus,
    ResetClaimIn,
    ResetIn,
    ResetInfo,
    UserRead,
)
from ..services import claim_rows, new_calendar_token, norm_name, rename_person

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("karpul.auth")

SessionDep = Annotated[Session, Depends(get_session)]
WriteSessionDep = Annotated[Session, Depends(get_write_session)]


def user_read(user: User) -> UserRead:
    """The account as its owner sees it, with `is_admin` as the server sees it."""
    out = UserRead.model_validate(user)
    out.is_admin = is_admin(user)
    return out


def _taken(session: Session, *, username: str | None = None, name_key: str | None = None) -> User | None:
    clauses = []
    if username is not None:
        clauses.append(User.username == username)
    if name_key is not None:
        clauses.append(User.name_key == name_key)
    if not clauses:
        return None
    where = clauses[0]
    for clause in clauses[1:]:
        where = where | clause
    return session.exec(select(User).where(where)).first()


def _signed_in(session: Session, user: User) -> AuthOut:
    token, row = start_session(session, user)
    session.commit()
    session.refresh(user)
    session.refresh(row)
    return AuthOut(token=token, expires_at=row.expires_at, user=user_read(user))


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, session: WriteSessionDep):
    """Create an account and sign the browser in with it.

    The display name (first + last) has to be free as well as the username: the board identifies people by that name, so two accounts
    answering to one name would be two people sharing a seat list. Rides and
    seats that already go by the name and belong to no account (from before
    accounts, or a seat a driver gave this colleague by name) become theirs.
    """
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.registrations.check(ip)
    ratelimit.registrations.hit(ip)
    name = f"{payload.first_name} {payload.last_name}"
    name_key = norm_name(name)
    clash = _taken(session, username=payload.username, name_key=name_key)
    if clash is not None:
        if clash.username == payload.username:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is taken")
        raise HTTPException(status.HTTP_409_CONFLICT, f"Another account already goes by {name}")
    user = User(
        username=payload.username,
        phone=payload.phone,
        first_name=payload.first_name,
        last_name=payload.last_name,
        name_key=name_key,
        password_hash=hash_password(payload.password),
        calendar_token=new_calendar_token(),
    )
    session.add(user)
    # Flush so the row has its id before a session row (or a claimed seat) points at it.
    session.flush()
    claimed = claim_rows(session, user)
    out = _signed_in(session, user)
    for ride in claimed:
        session.refresh(ride)
        ride_saved(ride, created=False)
    return out


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, request: Request, session: WriteSessionDep):
    """Sign in with the username and the password.

    Wrong passwords are counted per account and per address; past the limit
    the answer is 429 until the window has passed, right password or not.
    """
    account = f"login:{payload.login.strip().lower()}"
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.login_failures_by_account.check(account)
    ratelimit.login_failures_by_ip.check(ip)
    user = user_by_login(session, payload.login)
    if user is None:
        # Spend the same time as a real check, so a wrong username and a wrong
        # password are not told apart by how long the answer takes.
        burn_password_time(payload.password)
        ok = False
    else:
        ok = verify_password(payload.password, user.password_hash)
    if not ok:
        ratelimit.login_failures_by_account.hit(account)
        ratelimit.login_failures_by_ip.hit(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    if user.disabled:  # type: ignore[union-attr]
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is switched off. Ask an admin")
    ratelimit.login_failures_by_account.forget(account)
    return _signed_in(session, user)  # type: ignore[arg-type]


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(session: WriteSessionDep, creds: CredsDep):
    """Sign this browser out. Unknown or already-gone tokens are fine: the
    browser wanted to be signed out and it is."""
    if creds.token:
        end_session(session, creds.token)
        session.commit()


@router.post("/logout-others")
def logout_others(session: WriteSessionDep, creds: CredsDep):
    """Sign every other browser of this account out (a lost phone, a shared
    computer); this one stays signed in. Says how many were signed out."""
    user = require_user(session, creds)
    ended = end_other_sessions(session, user, creds.token)
    session.commit()
    return {"ended": ended}


@router.get("/me", response_model=UserRead)
def me(session: WriteSessionDep, creds: CredsDep):
    """Your account. A write route on purpose: the app calls it on every
    start, and that is when a session in use is pushed on (`renew_session`),
    so a phone opened now and then never sees the door again."""
    user = require_user(session, creds)
    if renew_session(session, creds.token):  # type: ignore[arg-type]
        session.commit()
        session.refresh(user)
    return user_read(user)


@router.post("/me/calendar-token", response_model=UserRead)
def rotate_calendar_token(session: WriteSessionDep, creds: CredsDep):
    """A new secret for your calendar feed: every calendar subscribed to the
    old address stops getting your rides."""
    user = require_user(session, creds)
    user.calendar_token = new_calendar_token()
    session.add(user)
    session.commit()
    session.refresh(user)
    return user_read(user)


@router.patch("/me", response_model=UserRead)
def update_me(payload: ProfileUpdate, session: WriteSessionDep, creds: CredsDep):
    """Change your own name, mobile number or password. An empty number
    removes it; it is optional.

    A new name is carried across every ride and booking you are in
    (`services.rename_person`), so the board shows it; the changed rides are
    pushed to the other tabs. A new password signs your other browsers out.
    """
    user = require_user(session, creds)
    data = payload.model_dump(exclude_unset=True)
    old_name = user.display_name

    if "phone" in data:
        user.phone = payload.phone

    if payload.prefill_rides is not None:
        user.prefill_rides = payload.prefill_rides

    first = payload.first_name if payload.first_name is not None else user.first_name
    last = payload.last_name if payload.last_name is not None else user.last_name
    new_name = f"{first} {last}"
    renamed: list = []
    renamed_photo = False
    if norm_name(new_name) != user.name_key or new_name != old_name:
        clash = _taken(session, name_key=norm_name(new_name))
        if clash is not None and clash.id != user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Another account already goes by {new_name}")
        user.first_name, user.last_name = first, last
        user.name_key = norm_name(new_name)
        renamed = rename_person(session, user, new_name)
        renamed_photo = session.get(ProfilePhoto, user.id) is not None

    if "new_password" in data and payload.new_password is not None:
        if not verify_password(payload.current_password or "", user.password_hash):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Wrong current password")
        user.password_hash = hash_password(payload.new_password)
        # Whoever else is holding a session with the old password loses it.
        end_other_sessions(session, user, creds.token)

    session.add(user)
    session.commit()
    session.refresh(user)
    for ride in renamed:
        session.refresh(ride)
        ride_saved(ride, created=False)
    # The board puts photos to names, so a renamed face has to be fetched again.
    if renamed_photo:
        photos_changed()
    return user_read(user)


# --- passkeys (app/passkeys.py) -------------------------------------------------


def _host(request: Request) -> str:
    return request.headers.get("host", "")


def _own_passkeys(session: Session, user: User) -> list[Passkey]:
    return list(session.exec(select(Passkey).where(Passkey.user_id == user.id).order_by(col(Passkey.id))).all())


@router.get("/passkeys", response_model=list[PasskeyRead])
def list_passkeys(session: SessionDep, creds: CredsDep):
    """The passkeys this account signs in with."""
    return _own_passkeys(session, require_user(session, creds))


@router.post("/passkeys/options")
def passkey_options(request: Request, session: WriteSessionDep, creds: CredsDep):
    """What the browser needs to make a passkey for this account: a fresh
    challenge, who the site and the person are, and the passkeys the account
    already has (the same device is not asked twice)."""
    user = require_user(session, creds)
    existing = _own_passkeys(session, user)
    if len(existing) >= passkeys.MAX_PASSKEYS:
        raise HTTPException(status.HTTP_409_CONFLICT, f"An account holds {passkeys.MAX_PASSKEYS} passkeys at most; remove one first")
    return passkeys.creation_options(
        host=_host(request),
        user_id=user.id,  # type: ignore[arg-type]
        username=user.username,
        display_name=user.display_name,
        existing=[p.credential_id for p in existing],
    )


@router.post("/passkeys", response_model=PasskeyRead, status_code=status.HTTP_201_CREATED)
def add_passkey(payload: PasskeyRegisterIn, request: Request, session: WriteSessionDep, creds: CredsDep):
    """Keep the passkey the browser just made, once it checks out."""
    user = require_user(session, creds)
    try:
        count = passkeys.verify_registration(
            credential_id=payload.id,
            client_data=payload.client_data,
            authenticator_data=payload.authenticator_data,
            public_key=payload.public_key,
            user_id=user.id,  # type: ignore[arg-type]
            host=_host(request),
        )
    except passkeys.PasskeyError as exc:
        log.info("passkey of %s refused: %s", user.username, exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That passkey could not be added; try again") from exc
    if session.exec(select(Passkey).where(Passkey.credential_id == payload.id)).first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That passkey is already added")
    if len(_own_passkeys(session, user)) >= passkeys.MAX_PASSKEYS:
        raise HTTPException(status.HTTP_409_CONFLICT, f"An account holds {passkeys.MAX_PASSKEYS} passkeys at most; remove one first")
    row = Passkey(
        user_id=user.id,  # type: ignore[arg-type]
        credential_id=payload.id,
        public_key=payload.public_key,
        sign_count=count,
        name=payload.name,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.delete("/passkeys/{passkey_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_passkey(passkey_id: int, session: WriteSessionDep, creds: CredsDep):
    """Forget a passkey (a phone sold or lost): it signs nobody in any more.
    The browsers already signed in stay so; *Sign out everywhere else* is for those."""
    user = require_user(session, creds)
    row = session.get(Passkey, passkey_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Passkey not found")
    session.delete(row)
    session.commit()


@router.post("/passkey-login/options")
def passkey_login_options(request: Request):
    """A challenge for signing in with a passkey. No username: the
    authenticator offers the passkeys it holds for this site."""
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.login_failures_by_ip.check(ip)
    ratelimit.passkey_challenges.check(ip)
    ratelimit.passkey_challenges.hit(ip)
    return passkeys.request_options(host=_host(request))


PASSKEY_REFUSED = "That passkey did not work here; sign in with your password"


@router.post("/passkey-login", response_model=AuthOut)
def passkey_login(payload: PasskeyLoginIn, request: Request, session: WriteSessionDep):
    """Sign in with a passkey: the credential says whose it is, the signature
    that it is them. A failure counts against the address like a wrong password."""
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.login_failures_by_ip.check(ip)
    row = session.exec(select(Passkey).where(Passkey.credential_id == payload.id)).first()
    user = session.get(User, row.user_id) if row is not None else None
    try:
        if row is None or user is None:
            raise passkeys.PasskeyError("unknown credential")
        count = passkeys.verify_assertion(
            client_data=payload.client_data,
            authenticator_data=payload.authenticator_data,
            signature=payload.signature,
            public_key=row.public_key,
            sign_count=row.sign_count,
            host=_host(request),
        )
    except passkeys.PasskeyError as exc:
        log.info("passkey sign-in refused: %s", exc)
        ratelimit.login_failures_by_ip.hit(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, PASSKEY_REFUSED) from exc
    if user.disabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is switched off. Ask an admin")
    row.sign_count = count
    row.last_used_at = utcnow()
    session.add(row)
    return _signed_in(session, user)


# --- password reset links (issued by an admin, routers/admin.py) --------------


def _live_reset(session: Session, token: str, request: Request):
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.reset_attempts.check(ip)
    row = reset_for_token(session, token)
    if row is None:
        ratelimit.reset_attempts.hit(ip)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This reset link has expired or was already used")
    return row


@router.get("/reset/{token}", response_model=ResetInfo)
def reset_info(token: str, request: Request, session: SessionDep):
    """Whose reset link this is, so the page can say "Set a new password, Ana"."""
    row = _live_reset(session, token, request)
    user = session.get(User, row.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This reset link has expired or was already used")
    return ResetInfo(username=user.username, display_name=user.display_name)


@router.post("/reset", response_model=AuthOut)
def reset_password(payload: ResetIn, request: Request, session: WriteSessionDep):
    """Set a new password with a reset link. The link is spent, every browser
    signed in to the account is signed out, and this one is signed in."""
    row = _live_reset(session, payload.token, request)
    user = session.get(User, row.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This reset link has expired or was already used")
    if user.disabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is switched off. Ask an admin")
    user.password_hash = hash_password(payload.new_password)
    row.used_at = utcnow()
    end_other_sessions(session, user, None)
    session.add(user)
    session.add(row)
    ratelimit.login_failures_by_account.forget(f"login:{user.username}")
    return _signed_in(session, user)


# --- "forgot password": an ask to the admins ---------------------------------
#
# Signed out, so the browser that asks gets a secret (`claim`) to come back
# with. An admin approves or declines under Approvals (routers/admin.py); the
# next poll after an approval hands this browser a one-time reset link, which
# the app opens as the ordinary reset card.

ASK_GONE = "This request has expired or was withdrawn; ask again"


def _ask_for_claim(session: Session, claim: str, request: Request) -> ResetRequest:
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.reset_attempts.check(ip)
    ask = session.exec(select(ResetRequest).where(ResetRequest.claim_hash == hash_token(claim))).first()
    if ask is None or reset_ask_expired(ask):
        ratelimit.reset_attempts.hit(ip)
        raise HTTPException(status.HTTP_404_NOT_FOUND, ASK_GONE)
    return ask


@router.post("/reset-requests", response_model=ResetAskOut, status_code=status.HTTP_201_CREATED)
def ask_for_reset(payload: ResetAskIn, request: Request, session: WriteSessionDep):
    """Ask the admins for a new password. Any earlier ask of the account is
    replaced, so only the newest browser to ask can get the link. Every admin
    is told."""
    ip = f"ip:{ratelimit.client_ip(request)}"
    ratelimit.reset_asks_by_ip.check(ip)
    user = user_by_login(session, payload.username)
    if user is None:
        ratelimit.reset_asks_by_ip.hit(ip)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account has that username")
    if user.disabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is switched off. Ask an admin")
    account = f"user:{user.id}"
    ratelimit.reset_asks_by_account.check(account)
    ratelimit.reset_asks_by_ip.hit(ip)
    ratelimit.reset_asks_by_account.hit(account)
    session.exec(delete(ResetRequest).where(col(ResetRequest.user_id) == user.id))  # type: ignore[call-overload]
    claim = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(10_000):04d}"
    session.add(ResetRequest(user_id=user.id, claim_hash=hash_token(claim), code=code))  # type: ignore[arg-type]
    admins = admin_ids(session)
    session.commit()
    notify(session, admins, "reset_requested", name=user.display_name, url="/")
    resets_changed(admins)
    return ResetAskOut(claim=claim, code=code)


@router.post("/reset-requests/status", response_model=ResetAskStatus)
def reset_ask_status(payload: ResetClaimIn, request: Request, session: WriteSessionDep):
    """Where this browser's ask stands. A write route: the first answer after
    an approval issues the reset link (its token, once) and the ask is spent;
    a declined ask is said once and goes too."""
    ask = _ask_for_claim(session, payload.claim, request)
    if ask.status == "pending":
        return ResetAskStatus(status="pending")
    if ask.status == "declined":
        session.delete(ask)
        session.commit()
        return ResetAskStatus(status="declined")
    user = session.get(User, ask.user_id)
    if user is None or user.disabled:
        session.delete(ask)
        session.commit()
        raise HTTPException(status.HTTP_404_NOT_FOUND, ASK_GONE)
    token, _ = issue_reset(session, user)
    session.delete(ask)
    session.commit()
    return ResetAskStatus(status="approved", token=token)


@router.post("/reset-requests/withdraw", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_reset_ask(payload: ResetClaimIn, request: Request, session: WriteSessionDep):
    """The person remembered after all: the ask leaves the admins' list."""
    ask = _ask_for_claim(session, payload.claim, request)
    session.delete(ask)
    admins = admin_ids(session)
    session.commit()
    resets_changed(admins)
