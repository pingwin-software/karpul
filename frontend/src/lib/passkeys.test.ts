import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { deviceName, fromB64u, PasskeyError, passkeyProblem, toB64u } from './passkeys'

describe('base64url', () => {
  it('round-trips bytes without padding or URL-unsafe characters', () => {
    const bytes = new Uint8Array([251, 255, 190, 0, 1, 2, 62, 63])
    const text = toB64u(bytes)
    expect(text).toBe('-_--AAECPj8')
    expect([...fromB64u(text)]).toEqual([...bytes])
    expect(toB64u(bytes.buffer)).toBe(text)
  })
})

describe('deviceName', () => {
  it('names the device and the browser', () => {
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone, Safari')
    expect(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36')).toBe('Android, Chrome')
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0')).toBe('Windows, Edge')
    expect(deviceName('Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0')).toBe('Linux, Firefox')
    expect(deviceName('something else')).toBe('')
  })
})

describe('passkeyProblem', () => {
  const words = { exists: 'has one', unsupported: 'cannot' }
  const say = (e: unknown) => passkeyProblem(e, words, (m) => `sr:${m}`, 'oops')
  it('says nothing when the person closed the sheet', () => {
    expect(say(new PasskeyError('cancelled'))).toBeNull()
  })
  it('has a sentence for the rest', () => {
    expect(say(new PasskeyError('exists'))).toBe('has one')
    expect(say(new PasskeyError('unsupported'))).toBe('cannot')
    expect(say(new ApiError(401, 'That passkey did not work here; sign in with your password'))).toBe(
      'sr:That passkey did not work here; sign in with your password',
    )
    expect(say(new Error('x'))).toBe('oops')
  })
})
