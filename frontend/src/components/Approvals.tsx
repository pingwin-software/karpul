import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { fmtShortDate, fmtTime, shortCarName, toISODate } from '../lib/dates'
import { errMsg } from '../lib/errors'
import { useT } from '../lib/i18n'
import type { Ride, WaitingResetAsk } from '../lib/types'
import { Avatar } from './Avatar'
import { PowertrainMark } from './CarArt'
import { ArrowRightIcon, CheckIcon } from './icons'
import { Sheet } from './Sheet'

interface Props {
  /** Bumped by the board after any decision or live change, so the list reloads. */
  version: number
  busyId: number | null
  onApprove: (ride: Ride) => void
  onDecline: (ride: Ride) => void
  /** Open the ride on the day plan, among that day's cars. */
  onOpen: (ride: Ride) => void
  /** The "forgot password" asks waiting (lib/useAdminDesk.ts). */
  resetAsks: WaitingResetAsk[]
  resetBusyId: number | null
  onDecideReset: (ask: WaitingResetAsk, approve: boolean) => Promise<void>
  onClose: () => void
}

/**
 * The admin's queue: every shared-car ride from today on that someone asked
 * for past their one a week, soonest first (backend: GET /api/admin/approvals).
 * Each is decided here without opening it; a tap on the ride itself opens it
 * on the day plan, to see what else has the car that day. Approving checks the
 * car is still free (a pending ride holds no slot), so it can be refused.
 *
 * Above them, the people who forgot their password and asked for a new one
 * from the sign-in screen. Each shows the four-digit code the person sees, so
 * the admin can check it with them before approving; once approved, their
 * screen gets a button to set a new password.
 */
export function Approvals({ version, busyId, onApprove, onDecline, onOpen, resetAsks, resetBusyId, onDecideReset, onClose }: Props) {
  const t = useT()
  const [rides, setRides] = useState<Ride[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .approvals()
      .then((list) => {
        setRides(list)
        setError(null)
      })
      .catch((e) => setError(t.apiError(e instanceof Error ? e.message : String(e))))
  }, [version, t])

  const [resetError, setResetError] = useState<string | null>(null)
  const decide = (ask: WaitingResetAsk, approve: boolean) => {
    setResetError(null)
    onDecideReset(ask, approve).catch((e) => setResetError(errMsg(e)))
  }

  return (
    <Sheet id="approvals-title" title={t.approvals.title} className="approvals" onClose={onClose}>
      {error && <p className="error">{error}</p>}
      {rides === null && !error && <p className="hint">{t.common.loading}</p>}
      {resetAsks.length > 0 && (
        <section className="approval-resets" aria-labelledby="approval-resets-title">
          <h3 id="approval-resets-title" className="approval-heading">
            {t.approvals.resetsTitle}
          </h3>
          {resetError && <p className="error">{resetError}</p>}
          <ul className="approval-list">
            {resetAsks.map((a) => {
              const busy = resetBusyId === a.id
              return (
                <li key={a.id} className="card approval-item">
                  <span className="approval-ride approval-reset">
                    <Avatar name={a.display_name} size="md" />
                    <span className="approval-what">
                      <strong>{a.display_name}</strong>
                      <span className="approval-when">
                        @{a.username} · {askedAt(a.created_at)}
                      </span>
                      <span className="approval-code">{t.approvals.resetCode(a.code)}</span>
                    </span>
                  </span>
                  <span className="approval-actions">
                    <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => decide(a, false)}>
                      {t.detail.decline}
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(a, true)}>
                      <CheckIcon size={16} /> {t.detail.approve}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="hint">{t.approvals.resetHint}</p>
          {rides && rides.length > 0 && (
            <h3 className="approval-heading">{t.approvals.ridesTitle}</h3>
          )}
        </section>
      )}
      {rides?.length === 0 && resetAsks.length === 0 && <div className="card empty-card empty-card-short">{t.approvals.empty}</div>}
      {rides && rides.length > 0 && (
        <ul className="approval-list">
          {rides.map((r) => {
            const busy = busyId === r.id
            return (
              <li key={r.id} className="card approval-item">
                <button type="button" className="approval-ride" title={t.approvals.open} onClick={() => onOpen(r)}>
                  <Avatar name={r.driver_name} size="md" />
                  <span className="approval-what">
                    <strong>{r.driver_name}</strong>
                    <span className="approval-when">
                      {fmtShortDate(r.ride_date)} · {fmtTime(r.departure_time)}
                      {r.return_time ? `–${fmtTime(r.return_time)}` : ''}
                    </span>
                    <span className="approval-car">
                      {shortCarName(r.car_name)}
                      <PowertrainMark carName={r.car_name} />
                    </span>
                    <span className="approval-route">
                      {r.origin}
                      <ArrowRightIcon size={12} />
                      {r.destination}
                    </span>
                  </span>
                </button>
                <span className="approval-actions">
                  <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onDecline(r)}>
                    {t.detail.decline}
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onApprove(r)}>
                    <CheckIcon size={16} /> {t.detail.approve}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

/** When an ask came, in this browser's own time: "Fri, Nov 20 09:14". The server's stamps are UTC. */
function askedAt(iso: string): string {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return `${fmtShortDate(toISODate(d))} ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`
}
