import { api, ApiError } from './api'
import type { Session } from './auth'
import type { Passkey } from './types'

/**
 * Passkeys: signing in with the device's fingerprint, face or PIN instead of
 * the password (backend: app/passkeys.py, which explains what is checked).
 *
 * The server speaks base64url for everything binary; this file turns that
 * into the buffers `navigator.credentials` wants and back. A passkey is made
 * while signed in (*Your account*) and used from the sign-in screen with no
 * username: the device offers the ones it holds for this site.
 */

export function toB64u(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let text = ''
  for (const b of bytes) text += String.fromCharCode(b)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64u(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Whether this browser can make and use passkeys at all. */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials
}

/**
 * What a new passkey is called in the list, so two of them can be told apart:
 * the device it was made on, as far as the browser lets on.
 */
export function deviceName(ua: string = navigator.userAgent): string {
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'Firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : ''
  return [device, browser].filter(Boolean).join(', ')
}

/** Why a passkey step ended without one; each has its own sentence in `t.passkeys`. */
export type PasskeyFailure = 'cancelled' | 'exists' | 'unsupported'

export class PasskeyError extends Error {
  reason: PasskeyFailure
  constructor(reason: PasskeyFailure) {
    super(reason)
    this.reason = reason
  }
}

/** What the browser throws when the person closes its sheet, or it times out. */
function failure(e: unknown): PasskeyFailure | null {
  if (!(e instanceof DOMException)) return null
  if (e.name === 'NotAllowedError' || e.name === 'AbortError') return 'cancelled'
  if (e.name === 'InvalidStateError') return 'exists'
  if (e.name === 'NotSupportedError' || e.name === 'SecurityError') return 'unsupported'
  return null
}

interface CreationOptionsJSON {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: PublicKeyCredentialParameters[]
  timeout: number
  attestation: AttestationConveyancePreference
  authenticatorSelection: AuthenticatorSelectionCriteria
  excludeCredentials: { type: 'public-key'; id: string }[]
}

interface RequestOptionsJSON {
  challenge: string
  rpId: string
  timeout: number
  userVerification: UserVerificationRequirement
}

/** Make a passkey on this device for the signed-in account and hand it to the server. */
export async function addPasskey(): Promise<Passkey> {
  if (!passkeysSupported()) throw new PasskeyError('unsupported')
  const options = await api.passkeyOptions<CreationOptionsJSON>()
  let made: Credential | null
  try {
    made = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: fromB64u(options.challenge),
        user: { ...options.user, id: fromB64u(options.user.id) },
        excludeCredentials: options.excludeCredentials.map((c) => ({ type: c.type, id: fromB64u(c.id) })),
      },
    })
  } catch (e) {
    const reason = failure(e)
    if (reason) throw new PasskeyError(reason)
    throw e
  }
  const credential = made as PublicKeyCredential | null
  const response = credential?.response as AuthenticatorAttestationResponse | undefined
  // The key as SubjectPublicKeyInfo: null when the browser does not know the
  // algorithm the authenticator picked, which leaves nothing to store.
  const key = response?.getPublicKey?.()
  if (!credential || !response || !key) throw new PasskeyError('unsupported')
  return api.addPasskey({
    id: toB64u(credential.rawId),
    client_data: toB64u(response.clientDataJSON),
    authenticator_data: toB64u(response.getAuthenticatorData()),
    public_key: toB64u(key),
    name: deviceName(),
  })
}

/** Sign in with a passkey this device holds; the session is the caller's to keep. */
export async function signInWithPasskey(): Promise<Session> {
  if (!passkeysSupported()) throw new PasskeyError('unsupported')
  const options = await api.passkeyLoginOptions<RequestOptionsJSON>()
  let got: Credential | null
  try {
    got = await navigator.credentials.get({ publicKey: { ...options, challenge: fromB64u(options.challenge) } })
  } catch (e) {
    const reason = failure(e)
    if (reason) throw new PasskeyError(reason)
    throw e
  }
  const credential = got as PublicKeyCredential | null
  const response = credential?.response as AuthenticatorAssertionResponse | undefined
  if (!credential || !response) throw new PasskeyError('cancelled')
  return api.passkeyLogin({
    id: toB64u(credential.rawId),
    client_data: toB64u(response.clientDataJSON),
    authenticator_data: toB64u(response.authenticatorData),
    signature: toB64u(response.signature),
  })
}

/** The sentence for whatever a passkey step failed with; null when the person just closed the sheet. */
export function passkeyProblem(
  e: unknown,
  words: { exists: string; unsupported: string },
  apiError: (message: string) => string,
  fallback: string,
): string | null {
  if (e instanceof PasskeyError) return e.reason === 'cancelled' ? null : words[e.reason]
  if (e instanceof ApiError) return apiError(e.message)
  return fallback
}
