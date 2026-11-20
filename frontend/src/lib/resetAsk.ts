/**
 * A "forgot password" ask this browser made (the sign-in screen's
 * `ForgotCard`), kept in localStorage so closing the app while an admin
 * decides loses nothing: the next start opens the card where it was. `claim`
 * is the secret the server gave for polling; `token`, once an admin approved,
 * is the reset link's (`/reset/<token>`).
 */
export interface StoredResetAsk {
  username: string
  claim: string
  code: string
  token?: string
}

const KEY = 'karpul.resetAsk'

export function loadResetAsk(): StoredResetAsk | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<StoredResetAsk>
    return typeof v.claim === 'string' && typeof v.code === 'string' && typeof v.username === 'string'
      ? { username: v.username, claim: v.claim, code: v.code, ...(typeof v.token === 'string' ? { token: v.token } : {}) }
      : null
  } catch {
    return null
  }
}

export function saveResetAsk(ask: StoredResetAsk): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ask))
  } catch {
    // Private mode: the ask still works while this screen stays open.
  }
}

export function clearResetAsk(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
