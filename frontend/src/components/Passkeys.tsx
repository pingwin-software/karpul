import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { messages, useT } from '../lib/i18n'
import { intlTag } from '../lib/locale'
import { addPasskey, passkeyProblem, passkeysSupported } from '../lib/passkeys'
import type { Passkey } from '../lib/types'

function day(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(intlTag(), { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The passkeys of your account, in *Your account*: the ones you have, each
 * with the device it was made on, and a button that makes one here. A
 * passkey is its own thing, not part of the form's Save: adding and removing
 * happen on the tap. A browser that cannot do passkeys still lists them, so
 * one made on a lost phone can be removed from a desktop.
 */
export function Passkeys({ onNotice }: { onNotice: (text: string) => void }) {
  const t = useT()
  const [list, setList] = useState<Passkey[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = passkeysSupported()

  useEffect(() => {
    let live = true
    api
      .passkeys()
      .then((found) => {
        if (live) setList(found)
      })
      .catch(() => {
        if (live) setList([])
      })
    return () => {
      live = false
    }
  }, [])

  function problem(e: unknown) {
    const m = messages()
    setError(passkeyProblem(e, m.passkeys, m.apiError, m.common.somethingWrong))
  }

  async function add() {
    setBusy(true)
    setError(null)
    try {
      const made = await addPasskey()
      setList((old) => [...(old ?? []), made])
      onNotice(messages().passkeys.added)
    } catch (e) {
      problem(e)
    } finally {
      setBusy(false)
    }
  }

  async function remove(passkey: Passkey) {
    setBusy(true)
    setError(null)
    try {
      await api.removePasskey(passkey.id)
      setList((old) => (old ?? []).filter((p) => p.id !== passkey.id))
      onNotice(messages().passkeys.removed)
    } catch (e) {
      problem(e)
    } finally {
      setBusy(false)
    }
  }

  if (!supported && !list?.length) return null

  return (
    <>
      <h3 className="account-section">{t.passkeys.title}</h3>
      {!!list?.length && (
        <ul className="passkey-list">
          {list.map((p) => (
            <li key={p.id} className="passkey">
              <span className="passkey-text">
                <span className="passkey-name">{p.name || t.passkeys.unnamed}</span>
                <span className="passkey-when">
                  {t.passkeys.madeOn(day(p.created_at))}, {p.last_used_at ? t.passkeys.usedOn(day(p.last_used_at)) : t.passkeys.neverUsed}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={busy}
                aria-label={t.passkeys.removeNamed(p.name || t.passkeys.unnamed)}
                onClick={() => void remove(p)}
              >
                {t.passkeys.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {supported && (
        <button type="button" className="btn btn-soft btn-block" disabled={busy || list === null} onClick={() => void add()}>
          {busy ? t.passkeys.adding : t.passkeys.add}
        </button>
      )}
      {supported && <p className="hint">{t.passkeys.hint}</p>}
      {error && <p className="error">{error}</p>}
    </>
  )
}
