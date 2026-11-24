import { useState } from 'react'
import { owesOfficeMail } from '../lib/carMail'
import { fmtDeadline } from '../lib/dates'
import { useT } from '../lib/i18n'
import { mayClaim, useMe } from '../lib/me'
import { drivable, type Person } from '../lib/people'
import type { Ride } from '../lib/types'
import { CarIcon, CheckIcon, MailIcon, UserIcon } from './icons'
import { PassengerPicker } from './PassengerPicker'

/** An admin's *Approve* / *Decline* on a shared car past its driver's share. */
export function ApprovalAsk({ ride, busy, onApprove, onDecline }: { ride: Ride; busy: boolean; onApprove: (ride: Ride) => void; onDecline: (ride: Ride) => void }) {
  const t = useT()
  return (
    <div className="approval-row">
      <span className="approval-ask">{t.detail.approvalAsk(ride.driver_name)}</span>
      <span className="approval-actions">
        <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onDecline(ride)}>
          {t.detail.decline}
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onApprove(ride)}>
          <CheckIcon size={16} /> {t.detail.approve}
        </button>
      </span>
    </div>
  )
}

/**
 * A shared car the office has not heard about (`Ride.office_mailed_at`):
 * the driver, and an admin, see it on the card with *Write the mail*, which
 * opens CarMailSheet with its *I already sent it*. Nobody else sees it.
 */
export function OfficeMailAsk({ ride, runsIt, isDriver, onWrite }: { ride: Ride; runsIt: boolean; isDriver: boolean; onWrite: (ride: Ride) => void }) {
  const t = useT()
  if (!runsIt || !owesOfficeMail(ride)) return null
  return (
    <div className="approval-row office-mail-row">
      <span className="approval-ask">{isDriver ? t.detail.officeMailAsk : t.detail.officeMailAskFor(ride.driver_name)}</span>
      <span className="approval-actions">
        <button type="button" className="btn btn-primary" onClick={() => onWrite(ride)}>
          <MailIcon size={16} /> {t.detail.officeMailWrite}
        </button>
      </span>
    </div>
  )
}

interface DriverAsksProps {
  ride: Ride
  busy: boolean
  /** The driver, or an admin (`runs()` in lib/me.ts). */
  runsIt: boolean
  isDriver: boolean
  isPast: boolean
  /** You have a seat in the car. */
  seated: boolean
  onTakeOver: (ride: Ride) => void
  /** An admin puts someone at the wheel of a car whose driver cancelled. */
  onPickDriver: (ride: Ride, person: Person) => Promise<void>
  /** An admin cancels it instead (the usual removal, with its confirmation). */
  onCancelRide: (ride: Ride) => void
  onConfirmRide: (ride: Ride) => void
  onClaim: (ride: Ride) => void
}

/**
 * The rows that ask about who drives: a shared car whose driver cancelled
 * (*I'll drive* for a passenger, *Pick a driver* and *Cancel the ride* for an
 * admin, and for everyone the deadline after which it is off, app/driverless.py), a ride from the paper log waiting for its driver to confirm
 * it, and *This is me* on a ride whose driver has no account (past rides
 * too: the paper log is mostly behind us).
 */
export function DriverAsks({ ride, busy, runsIt, isDriver, isPast, seated, onTakeOver, onPickDriver, onCancelRide, onConfirmRide, onClaim }: DriverAsksProps) {
  const t = useT()
  const me = useMe()
  const [picking, setPicking] = useState(false)
  const deadline = ride.driver_deadline ? fmtDeadline(ride.driver_deadline) : null
  return (
    <>
      {ride.needs_driver && !isPast && (
        <div className="approval-row">
          <span className="approval-ask">
            {seated ? t.detail.takeOverAsk(ride.driver_name) : runsIt ? t.detail.takeOverAdmin(ride.driver_name) : t.detail.takeOverWait(ride.driver_name)}
            {deadline && <span className="approval-deadline">{t.detail.driverDeadline(deadline.time, deadline.day)}</span>}
          </span>
          {(seated || (runsIt && !picking)) && (
            <span className="approval-actions">
              {runsIt && !picking && (
                <>
                  <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onCancelRide(ride)}>
                    {t.detail.cancelDriverless}
                  </button>
                  <button type="button" className={seated ? 'btn btn-soft' : 'btn btn-primary'} disabled={busy} onClick={() => setPicking(true)}>
                    <UserIcon size={16} /> {t.detail.pickDriver}
                  </button>
                </>
              )}
              {seated && (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onTakeOver(ride)}>
                  <CarIcon size={16} /> {t.detail.takeOver}
                </button>
              )}
            </span>
          )}
          {runsIt && picking && (
            <PassengerPicker
              ride={ride}
              busy={busy}
              candidates={drivable}
              label={t.detail.findDriver}
              onPick={(person) => {
                if (busy) return
                // The picker stays until the ride has its driver, so the row goes in one step.
                void onPickDriver(ride, person).then(() => setPicking(false))
              }}
              onCancel={() => setPicking(false)}
            />
          )}
        </div>
      )}

      {ride.unconfirmed && !isPast && (
        <div className="approval-row">
          <span className="approval-ask">
            {!runsIt ? t.detail.unconfirmedWait(ride.driver_name) : isDriver ? t.detail.confirmAsk : t.detail.confirmAskFor(ride.driver_name)}
          </span>
          {runsIt && (
            <span className="approval-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onConfirmRide(ride)}>
                <CheckIcon size={16} /> {t.detail.confirm}
              </button>
            </span>
          )}
        </div>
      )}

      {mayClaim(ride, me) && (
        <div className="claim-row">
          <span className="claim-ask">{t.detail.claimAsk(ride.driver_name)}</span>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onClaim(ride)}>
            <CheckIcon size={16} /> {t.detail.claim}
          </button>
        </div>
      )}
    </>
  )
}
