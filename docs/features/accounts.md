# Accounts: profile photos, calling the driver and passkeys

Moved out of CLAUDE.md, which keeps a one-line pointer here. These are the
feature notes for working on this part of Karpul: the rules, where they live
and why. Keep them in step with the code like CLAUDE.md itself.

**Profile photos** (`routers/photos.py`, table `ProfilePhoto`). `components/AccountSheet.tsx` picks a file and opens it in
`PhotoCropper` (inline in the sheet, not a second overlay): the picture dimmed round a square outline (what is saved)
with the avatar's circle inside it, dragged, pinched, wheeled or arrow-keyed, with a zoom slider up to `MAX_ZOOM`
(the geometry is `fitCrop` / `zoomCrop` in `lib/photos.ts`, tested in `photos.test.ts`). `squarePhoto` then draws that
square at 256 px as WebP (JPEG where the browser cannot write WebP) before `PUT /api/auth/me/photo` (raw body, no multipart). The server only sniffs the first bytes
(JPEG/PNG/WebP) and caps the size (`MAX_PHOTO_BYTES`). The bytes live in the database, so the backup carries
them. An `<img>` cannot send a bearer token, so a photo is served openly at `/api/avatars/<key>` with a random
key that changes on every upload (the old address 404s), `immutable` and `nosniff`; the service worker caches
those addresses (`karpul-photos`), the one exception to "nothing under `/api` is cached". Every place draws an
avatar by *name*, so the board fetches the whole list (`GET /api/avatars`, signed in) into the external store in
`lib/photos.ts`, and `Avatar` looks its name up there (`normName` in `lib/dates.ts`) and falls back to the
initials. `useBoard` refetches it on every (re)connect and on `photos.changed`, which an upload, a removal, a
rename of someone with a photo and an account deletion publish. An admin takes one down from *People*
(`DELETE /api/admin/users/{id}/photo`, logged as `photo_removed`). Tests: `tests/test_photos.py`.

**Calling the driver.** `User.phone` is optional and shown on the rides that person drives:
`RideRead.driver_phone` is looked up by `driver_id` (`board_extras` in `services.py`, one query for
the whole board in `GET /api/rides`, next to the thread's message counts), and `CarDetail` turns it into a *Call the driver* `tel:` link
for everyone but the driver. **Karpul keeps no email**: the office mail writes addresses from names
(`lib/carMail.ts`), so an account is a username, a name and a password, and signing in is by username.
`appuser.email` is in `DROPPED_COLUMNS` in `database.py`: `rebuild_tables` rebuilds that table once on
start without it (and its unique index) and VACUUMs, so the addresses leave the file too. An app from
before still sending `email` is ignored, not refused.

**Passkeys** (`app/passkeys.py`, table `Passkey`, `lib/passkeys.ts`, `components/Passkeys.tsx`). Signing in with the
device's fingerprint, face or screen lock instead of the password, for an app with no email to send a reset to; the
password keeps working beside it. WebAuthn done on the `cryptography` package with no WebAuthn library, for the reason
`app/webpush.py` gives, and kept small by two choices: **no attestation** (the browser is asked for `"none"` and hands
over what it already parsed: the authenticator data and the public key as SubjectPublicKeyInfo from `getPublicKey()`, so
nothing reads CBOR; the key is taken on trust the first time, from someone who is signed in, and only ever opens their
own account) and **discoverable credentials only** (signing in sends no username: the device offers the passkeys it
holds for the site and the credential id says whose it is). What `verify_registration` / `verify_assertion` hold a
sign-in to: a challenge this process issued for that purpose (and, for adding one, that account) in the last five
minutes, spent by the look (`Challenges`, in memory like the throttles, one worker); the page's origin is this site
(`origin_ok`: https, or http on localhost); the data is for this site (`rpIdHash`); the UP and UV flags (someone was
there and proved it was them, so a passkey is not a weaker door than a password); the signature under the stored key
(P-256, Ed25519 or RSA, by the key's own type); and a counter that moved forward when the authenticator keeps one. The
site's name (`rp_id`) is the host the request came to, or `KARPUL_RP_ID` to bind them to a parent domain; **changing it
orphans every passkey**, as moving the site to another host does. A passkey cannot be used on an IP address, which is
why `e2e/onday.spec.ts` visits the server as `localhost`.

The routes, all in `routers/auth.py`: `GET /api/auth/passkeys` (yours: name, added, last used; never the key),
`POST /api/auth/passkeys/options` then `POST /api/auth/passkeys` (signed in; `MAX_PASSKEYS` 10; a credential belongs to
one account, 409), `DELETE /api/auth/passkeys/{id}`, and signed out `POST /api/auth/passkey-login/options` then
`POST /api/auth/passkey-login`, which answers like `/login` (`AuthOut`). Every refusal is the one wording (401, the
reason only in the log) and counts against the address like a wrong password (`login_failures_by_ip`); an account
switched off is 403 as for a password. A password reset leaves the passkeys alone; deleting the account takes them.
In the app: *Passkeys* in *Your account* lists them (named by `deviceName`: "Android, Chrome") with *Add a passkey on
this device* and *Remove*, acting on the tap, not the form's Save; a browser that cannot make one still lists them, so a
lost phone's can be removed from a desktop. *Sign in with a passkey* is on the sign-in tab where the browser can. The
person closing the browser's sheet (`NotAllowedError`) is not an error and says nothing. Tests: `tests/test_passkeys.py`
(a software authenticator signing what a phone would), `passkeys.test.ts`, and the virtual authenticator in
`e2e/onday.spec.ts`.
