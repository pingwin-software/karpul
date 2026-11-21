import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { setSession } from '../lib/auth'
import { messages, useT } from '../lib/i18n'
import { slideClass, useSlideDir } from '../lib/motion'
import { passkeyProblem, passkeysSupported, signInWithPasskey } from '../lib/passkeys'
import { clearResetAsk, loadResetAsk, saveResetAsk, type StoredResetAsk } from '../lib/resetAsk'
import { LanguageSwitch } from './LanguageSwitch'
import { Logo } from './Logo'
import { SegThumb } from './Segmented'

type Mode = 'in' | 'up'
const MODES: Mode[] = ['in', 'up']

/**
 * The door. Nothing of the board is drawn until somebody is signed in, so this
 * is the whole screen: sign in with a username and a password, or register,
 * which signs the new account in straight away. No email is asked for (the
 * office mail writes addresses from names); the mobile number is optional and
 * says so in its label.
 *
 * The two tabs slide the way the other switched views do (lib/motion.ts), and
 * the language switch sits at the foot because a newcomer meets this screen
 * before the menu, exactly as they used to meet the name sheet.
 *
 * With `resetToken` (the app was opened on an admin's `/reset/<token>` link)
 * it is the "set a new password" card instead (`ResetCard`). *Forgot your
 * password?* opens `ForgotCard`, which asks the admins for a new one.
 */
export function AuthGate({ resetToken = null, onResetDone }: { resetToken?: string | null; onResetDone?: () => void }) {
  if (resetToken) return <ResetCard token={resetToken} onDone={onResetDone ?? (() => undefined)} />
  return <SignIn />
}

function SignIn() {
  // An ask still open from an earlier visit opens straight on its card.
  const [forgot, setForgot] = useState(() => loadResetAsk() !== null)
  const [login, setLogin] = useState('')
  if (forgot) return <ForgotCard username={login.trim()} onBack={() => setForgot(false)} />
  return <SignInForm login={login} setLogin={setLogin} onForgot={() => setForgot(true)} />
}

function SignInForm({ login, setLogin, onForgot }: { login: string; setLogin: (v: string) => void; onForgot: () => void }) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('in')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dir = useSlideDir(mode, (m) => MODES.indexOf(m as Mode))

  const ready =
    mode === 'in'
      ? login.trim().length > 0 && password.length > 0
      : [username, firstName, lastName].every((v) => v.trim().length > 0) && password.length > 0

  function pick(next: Mode) {
    if (next === mode) return
    setMode(next)
    setError(null)
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const session =
        mode === 'in'
          ? await api.login(login.trim(), password)
          : await api.register({
              username: username.trim(),
              phone: phone.trim() || undefined,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              password,
            })
      // The board is behind this: App re-renders the moment the store changes.
      setSession(session)
    } catch (err) {
      const m = messages()
      setError(err instanceof ApiError ? m.apiError(err.message) : m.common.somethingWrong)
      setBusy(false)
    }
  }

  /** No username: the device offers the passkeys it holds for this site. */
  async function withPasskey() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setSession(await signInWithPasskey())
    } catch (err) {
      const m = messages()
      setError(passkeyProblem(err, m.passkeys, m.apiError, m.common.somethingWrong))
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card card">
        <h1 className="auth-title">
          <Logo /> Karpul
        </h1>
        <p className="auth-tagline">{t.auth.tagline}</p>

        <div className="segmented" role="tablist" aria-label={t.auth.signIn}>
          <SegThumb count={MODES.length} index={MODES.indexOf(mode)} />
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === mode}
              className={m === mode ? 'seg seg-on' : 'seg'}
              onClick={() => pick(m)}
            >
              {m === 'in' ? t.auth.signInTab : t.auth.signUpTab}
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div key={mode} className={['stack', slideClass(dir)].filter(Boolean).join(' ')}>
            {mode === 'in' ? (
              <label className="field">
                <span className="field-label">{t.auth.login}</span>
                <input
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={200}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </label>
            ) : (
              <>
                <div className="grid-2">
                  <label className="field">
                    <span className="field-label">{t.auth.firstName}</span>
                    <input
                      autoFocus
                      autoComplete="given-name"
                      maxLength={40}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t.auth.lastName}</span>
                    <input
                      autoComplete="family-name"
                      maxLength={40}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">{t.auth.username}</span>
                  <input
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={32}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <p className="hint">{t.auth.usernameHint}</p>
                <label className="field">
                  <span className="field-label">
                    {t.auth.phone} <span className="field-optional">{t.auth.optional}</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <p className="hint">{t.auth.phoneHint}</p>
              </>
            )}

            <label className="field">
              <span className="field-label">{t.auth.password}</span>
              <input
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {mode === 'up' && <p className="hint">{t.auth.passwordHint}</p>}
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={!ready || busy}>
            {busy ? t.auth.working : mode === 'in' ? t.auth.submitSignIn : t.auth.submitSignUp}
          </button>
          {mode === 'in' && passkeysSupported() && (
            <button type="button" className="btn btn-soft btn-block" disabled={busy} onClick={() => void withPasskey()}>
              {t.auth.passkey}
            </button>
          )}
          <button type="button" className="link auth-switch" onClick={() => pick(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? t.auth.switchToSignUp : t.auth.switchToSignIn}
          </button>
          {mode === 'in' && (
            <button type="button" className="link auth-switch auth-forgot" onClick={onForgot}>
              {t.auth.forgot}
            </button>
          )}
        </form>
      </div>

      <LanguageSwitch compact />
    </div>
  )
}

/** How often a waiting ask looks whether an admin has decided. */
const ASK_POLL_MS = 10_000

type AskState = 'form' | 'pending' | 'approved' | 'declined' | 'gone'

/**
 * Forgot the password: ask the admins for a new one. The ask goes to every
 * admin (a push, and *Approvals*); this card then waits, showing a four-digit
 * code the admin may ask to hear before approving. Once an admin approves,
 * the card's button opens the ordinary reset card on a one-time link. The ask
 * lives in localStorage (lib/resetAsk.ts), so the app can be closed meanwhile.
 */
function ForgotCard({ username: typed, onBack }: { username: string; onBack: () => void }) {
  const t = useT()
  const [ask, setAsk] = useState<StoredResetAsk | null>(loadResetAsk)
  const [username, setUsername] = useState(ask?.username ?? typed)
  const [state, setState] = useState<AskState>(ask ? (ask.token ? 'approved' : 'pending') : 'form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async (current: StoredResetAsk) => {
    try {
      const answer = await api.resetAskStatus(current.claim)
      if (answer.status === 'approved' && answer.token) {
        const next = { ...current, token: answer.token }
        saveResetAsk(next)
        setAsk(next)
        setState('approved')
      } else if (answer.status === 'declined') {
        clearResetAsk()
        setState('declined')
      }
    } catch (err) {
      // Gone (withdrawn elsewhere, replaced by a newer ask, a day old); a
      // network hiccup just waits for the next look.
      if (err instanceof ApiError && err.status === 404) {
        clearResetAsk()
        setState('gone')
      }
    }
  }, [])

  useEffect(() => {
    if (state !== 'pending' || !ask) return
    // Data fetching: the state update happens after the await, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    void check(ask)
    const id = setInterval(() => void check(ask), ASK_POLL_MS)
    const onBackAgain = () => {
      if (document.visibilityState === 'visible') void check(ask)
    }
    document.addEventListener('visibilitychange', onBackAgain)
    window.addEventListener('focus', onBackAgain)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onBackAgain)
      window.removeEventListener('focus', onBackAgain)
    }
  }, [state, ask, check])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = username.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      const made = await api.askReset(name)
      const next = { username: name, claim: made.claim, code: made.code }
      saveResetAsk(next)
      setAsk(next)
      setState('pending')
    } catch (err) {
      const m = messages()
      setError(err instanceof ApiError ? m.apiError(err.message) : m.common.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  function withdraw() {
    if (ask) api.withdrawResetAsk(ask.claim).catch(() => undefined)
    clearResetAsk()
    onBack()
  }

  function again() {
    clearResetAsk()
    setAsk(null)
    setState('form')
  }

  function back() {
    if (state !== 'pending') clearResetAsk()
    onBack()
  }

  function openReset() {
    if (!ask?.token) return
    clearResetAsk()
    // The app reads `/reset/<token>` on start (App.tsx, readResetToken).
    window.location.assign(`/reset/${encodeURIComponent(ask.token)}`)
  }

  return (
    <div className="auth">
      <div className="auth-card card">
        <h1 className="auth-title">
          <Logo /> Karpul
        </h1>
        <p className="auth-tagline">{t.forgot.title}</p>

        {state === 'form' && (
          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">{t.auth.username}</span>
              <input
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={200}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !username.trim()}>
              {busy ? t.auth.working : t.forgot.submit}
            </button>
          </form>
        )}

        {state === 'pending' && ask && (
          <div className="auth-form" role="status">
            <p>{t.forgot.waiting}</p>
            <p className="forgot-code" aria-label={t.forgot.codeLabel(ask.code)}>
              {ask.code}
            </p>
            <p className="hint">{t.forgot.codeHint}</p>
            <button type="button" className="btn btn-soft btn-block" onClick={withdraw}>
              {t.forgot.withdraw}
            </button>
          </div>
        )}

        {state === 'approved' && (
          <div className="auth-form" role="status">
            <p>{t.forgot.approved}</p>
            <button type="button" className="btn btn-primary btn-block" autoFocus onClick={openReset}>
              {t.reset.title}
            </button>
          </div>
        )}

        {(state === 'declined' || state === 'gone') && (
          <div className="auth-form" role="status">
            <p className="error">{state === 'declined' ? t.forgot.declined : t.forgot.gone}</p>
            <button type="button" className="btn btn-soft btn-block" onClick={again}>
              {t.forgot.again}
            </button>
          </div>
        )}

        <button type="button" className="link auth-switch" onClick={back}>
          {t.reset.backToSignIn}
        </button>
      </div>

      <LanguageSwitch compact />
    </div>
  )
}

/**
 * A password reset link from an admin: says whose it is, takes a new
 * password, and signs this browser in with it (every other browser of the
 * account is signed out by the server). A link that is spent or too old says
 * so, with the way back to the ordinary sign-in.
 */
function ResetCard({ token, onDone }: { token: string; onDone: () => void }) {
  const t = useT()
  const [who, setWho] = useState<{ display_name: string } | null | 'dead'>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .resetInfo(token)
      .then((info) => live && setWho(info))
      .catch(() => live && setWho('dead'))
    return () => {
      live = false
    }
  }, [token])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const session = await api.resetPassword(token, password)
      onDone()
      setSession(session)
    } catch (err) {
      const m = messages()
      setError(err instanceof ApiError ? m.apiError(err.message) : m.common.somethingWrong)
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card card">
        <h1 className="auth-title">
          <Logo /> Karpul
        </h1>
        <p className="auth-tagline">{t.reset.title}</p>

        {who === null && <p className="hint">{t.common.loading}</p>}
        {who === 'dead' && <p className="error">{t.reset.expired}</p>}
        {who && who !== 'dead' && (
          <form className="auth-form" onSubmit={submit}>
            <p className="hint">{t.reset.greeting(who.display_name)}</p>
            <label className="field">
              <span className="field-label">{t.reset.newPassword}</span>
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="hint">{t.auth.passwordHint}</p>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || password.length === 0}>
              {busy ? t.auth.working : t.reset.submit}
            </button>
          </form>
        )}
        <button type="button" className="link auth-switch" onClick={onDone}>
          {t.reset.backToSignIn}
        </button>
      </div>

      <LanguageSwitch compact />
    </div>
  )
}
