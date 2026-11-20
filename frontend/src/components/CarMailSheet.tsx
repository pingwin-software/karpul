import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { carMail, carMailHref } from '../lib/carMail'
import { fmtShortDate } from '../lib/dates'
import { errMsg } from '../lib/errors'
import { useT } from '../lib/i18n'
import { useKept } from '../lib/keep'
import type { Person } from '../lib/people'
import type { Ride } from '../lib/types'
import { CheckIcon, MailIcon } from './icons'
import { Sheet } from './Sheet'

interface Props {
  /** The shared-car rides the mail is about (a ride, and its way back when there is one). */
  rides: Ride[]
  /** The first of a weekly series: the last week. */
  repeatUntil?: string | null
  /** Right after taking the car: no way out until the mail is opened or said to be sent. */
  locked?: boolean
  /** The rides as the server has them once the mail is said to be sent. */
  onSent: (rides: Ride[]) => void
  onError: (text: string) => void
  onClose: () => void
}

/**
 * The mail to the office about a shared car (lib/carMail.ts), with every admin
 * in copy, shown as it will go out (by name: the addresses only go into the link), and a button that opens it in the driver's
 * mail app. The app cannot see that app, so the driver says when it went out
 * (*I sent it*, or *I already sent it* for a mail written by hand), which is
 * the office mail's record (`Ride.office_mailed_at`). Right after taking the
 * car it cannot be skipped until the mail is opened; after that *Not yet*
 * leaves it to the ride card to ask again. The admins are looked up when it opens.
 */
export function CarMailSheet({ rides, repeatUntil, locked = false, onSent, onError, onClose }: Props) {
  const t = useT()
  const [admins, setAdmins] = useState<Person[] | null>(null)
  // The mail app was opened: an installed app may come back reloaded, so it is kept.
  const [opened, setOpened] = useKept('carMail.opened', false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let live = true
    api
      .people()
      .then((people) => live && setAdmins(people.filter((p) => p.is_admin)))
      .catch(() => live && setAdmins([]))
    return () => {
      live = false
    }
  }, [])
  const mail = admins && carMail(rides, admins, repeatUntil)
  const first = rides[0]

  async function markSent() {
    setSaving(true)
    try {
      const saved: Ride[] = []
      for (const r of rides) saved.push(await api.officeMailed(r.id, !!repeatUntil))
      setOpened(false)
      onSent(saved)
    } catch (e) {
      setSaving(false)
      onError(errMsg(e))
    }
  }
  const close = () => {
    setOpened(false)
    onClose()
  }

  return (
    <Sheet
      id="car-mail-title"
      title={t.carMail.title}
      onClose={close}
      locked={locked && !opened}
      className="car-mail"
      footer={
        <div className="car-mail-actions">
          {opened ? (
            <>
              <button type="button" className="btn" disabled={saving} onClick={close}>
                {t.carMail.notYet}
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void markSent()}>
                <CheckIcon size={18} /> {t.carMail.sent}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" disabled={saving || !mail} onClick={() => void markSent()}>
                {t.carMail.alreadySent}
              </button>
              {mail ? (
                <a className="btn btn-primary" href={carMailHref(mail)} onClick={() => setTimeout(() => setOpened(true), 0)}>
                  <MailIcon size={18} /> {t.carMail.open}
                </a>
              ) : (
                <button type="button" className="btn btn-primary" disabled>
                  <MailIcon size={18} /> {t.carMail.open}
                </button>
              )}
            </>
          )}
        </div>
      }
    >
      {/* Opened from the approval's notification or the ride card, days later: which car this is. */}
      {!locked && first.approval === 'approved' && <p className="car-mail-about">{t.carMail.approved(first.car_name, fmtShortDate(first.ride_date))}</p>}
      {!mail ? (
        <p className="car-mail-wait">{t.carMail.loading}</p>
      ) : (
        <div className="car-mail-preview">
          <dl className="car-mail-head">
            <dt>{t.carMail.to}</dt>
            <dd>{mail.toName}</dd>
            {mail.ccNames.length > 0 && (
              <>
                <dt>{t.carMail.cc}</dt>
                <dd>{mail.ccNames.join(', ')}</dd>
              </>
            )}
          </dl>
          <p className="car-mail-subject">{mail.subject}</p>
          <pre className="car-mail-body">{mail.body}</pre>
        </div>
      )}
      {opened && <p className="car-mail-wait">{t.carMail.later}</p>}
    </Sheet>
  )
}
