import { CLOCK, firstName, fmtShortDate, fmtTime, shortCarName } from '../lib/dates'
import { useT } from '../lib/i18n'
import { intlTag } from '../lib/locale'
import { comingRides, type OfflineRide, type OfflineSnapshot } from '../lib/offline'
import { telHref } from '../lib/support'
import { ArrowRightIcon, PhoneIcon, PinIcon, SteeringIcon, UsersIcon } from './icons'

/** How many rides the card lists; the rest are a count. */
const SHOWN = 3

function seenAt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(intlTag(), { weekday: 'short', day: 'numeric', month: 'short', ...CLOCK })
}

/** "Pavle (Bulevar 12), Mila": a place only when it is not where the ride starts. */
function others(ride: OfflineRide): string {
  return ride.passengers.map((p) => (p.pickup && p.pickup !== ride.origin ? `${firstName(p.name)} (${p.pickup})` : firstName(p.name))).join(', ')
}

/**
 * The board could not be reached: your coming rides as this browser last saw
 * them (lib/offline.ts), with what you need at a pickup point and nothing to
 * tap but the driver's number and *Try again*. It says how old the copy is,
 * because a ride may have changed since.
 */
export function OfflineCard({ snapshot, busy, onRetry }: { snapshot: OfflineSnapshot; busy: boolean; onRetry: () => void }) {
  const t = useT()
  const rides = comingRides(snapshot)
  const when = seenAt(snapshot.savedAt)
  return (
    <section className="card offline-card" role="status" aria-label={t.offline.title}>
      <div className="offline-head">
        <strong>{t.offline.title}</strong>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onRetry}>
          {t.offline.retry}
        </button>
      </div>
      <p className="offline-when">{rides.length ? t.offline.asOf(when) : t.offline.none(when)}</p>
      {rides.length > 0 && (
        <ul className="offline-list">
          {rides.slice(0, SHOWN).map((r) => (
            <li key={r.id} className="offline-ride">
              <span className="offline-time">
                {fmtShortDate(r.ride_date)} <strong>{fmtTime(r.departure_time)}</strong>
              </span>
              <span className="offline-route">
                {r.origin} <ArrowRightIcon size={14} /> {r.destination}
              </span>
              <span className="offline-line">
                <SteeringIcon size={14} />
                {r.role === 'driver' ? t.offline.youDrive : t.offline.drives(r.driver_name)} · {shortCarName(r.car_name)}
              </span>
              {r.role === 'passenger' && (
                <span className="offline-line">
                  <PinIcon size={14} /> {t.offline.getIn(r.pickup || r.origin)}
                </span>
              )}
              <span className="offline-line">
                <UsersIcon size={14} /> {r.passengers.length ? t.offline.withYou(others(r)) : t.offline.nobodyYet}
              </span>
              {r.role === 'passenger' && r.driver_phone && (
                <a className="btn btn-sm offline-call" href={telHref(r.driver_phone)}>
                  <PhoneIcon size={16} /> {t.offline.call(firstName(r.driver_name))}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {rides.length > SHOWN && <p className="offline-when">{t.offline.more(rides.length - SHOWN)}</p>}
    </section>
  )
}
