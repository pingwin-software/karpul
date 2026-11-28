import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '../lib/api'
import { setUser, type AuthUser } from '../lib/auth'
import { fmtShortDate, fmtTime, shortCarName } from '../lib/dates'
import { fmtRsd } from '../lib/fleet'
import { messages, useT } from '../lib/i18n'
import { officeRuns, quiet, rideRank } from '../lib/rideRank'
import type { PersonStats, StatBucket } from '../lib/types'
import { Avatar } from './Avatar'
import { CountUp } from './CountUp'
import { CalendarIcon, CarProfileIcon, CopyIcon, LeafIcon, PeopleIcon, RepeatIcon, RoadIcon, SteeringIcon, UserIcon } from './icons'
import { SegThumb } from './Segmented'
import { Sheet } from './Sheet'

interface Props {
  user: AuthUser
  /** A line for the board's toast. */
  onNotice: (text: string) => void
  onClose: () => void
}

/**
 * Your rides: who you are on the board (a title earned from the all-time
 * figures, `lib/rideRank.ts`), the figures for this month or all time behind
 * one switch, what your seats took off the road, the calendar feed address
 * and the past rides. The figures are the signed-in account's own
 * (`/api/stats/me`); the feed address carries a secret of its own, because a
 * calendar app cannot sign in, and a new one cuts off every old subscription.
 */
export function MyRides({ user, onNotice, onClose }: Props) {
  const t = useT()
  const userName = user.display_name
  const [stats, setStats] = useState<PersonStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    let live = true
    api
      .myStats()
      .then((s) => live && setStats(s))
      .catch((e) => live && setError(e instanceof Error ? messages().apiError(e.message) : messages().common.somethingWrong))
    return () => {
      live = false
    }
  }, [])

  const feedUrl = user.calendar_token ? new URL(api.calendarFeedUrl(user.calendar_token), window.location.origin).href : ''

  async function rotateFeed() {
    setRotating(true)
    try {
      setUser(await api.rotateCalendarToken())
      onNotice(messages().myRides.feedChanged)
    } catch (e) {
      setError(e instanceof Error ? messages().apiError(e.message) : messages().common.somethingWrong)
    } finally {
      setRotating(false)
    }
  }

  async function copyFeed() {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* the address is on screen to select by hand */
    }
  }

  return (
    <Sheet id="my-rides-title" title={t.myRides.title} onClose={onClose}>
      <>
          <div className="mr-hero">
            <Avatar name={userName} size="lg" />
            <span className="mr-hero-text">
              <strong>{userName}</strong>
              {stats && <span className="mr-rank">{t.myRides.rank[rideRank(stats.all)]}</span>}
            </span>
            <span className="mr-road" aria-hidden="true">
              <CarProfileIcon size={26} className="mr-road-car" />
            </span>
          </div>
          {error && <p className="error">{error}</p>}
          {stats ? (
            <>
              <Figures stats={stats} />
              <Impact bucket={stats.all} />

              <h3 className="section-title">{t.myRides.feed}</h3>
              <div className="feed-row">
                <CalendarIcon size={18} />
                <code className="feed-url">{feedUrl}</code>
                <button type="button" className="btn btn-soft" disabled={!feedUrl} onClick={() => void copyFeed()}>
                  <CopyIcon size={16} /> {copied ? t.toasts.linkCopied : t.common.copy}
                </button>
              </div>
              <p className="hint">{t.myRides.feedHint}</p>
              <button type="button" className="soft-action feed-new" disabled={rotating} onClick={() => void rotateFeed()}>
                <RepeatIcon size={15} /> {t.myRides.feedNew}
              </button>
              <p className="hint hint-tight">{t.myRides.feedNewHint}</p>

              <h3 className="section-title">{t.myRides.history}</h3>
              {stats.history.length === 0 ? (
                <p className="hint">{t.myRides.noHistory}</p>
              ) : (
                <ul className="history-list">
                  {stats.history.map((h) => (
                    <li key={h.id} className="history-row">
                      <span className="history-when">
                        <span className="when-value">{fmtShortDate(h.ride_date)}</span>
                        <small>{fmtTime(h.departure_time)}</small>
                      </span>
                      <span className="history-text">
                        <strong>{t.myRides.route(h.origin, h.destination)}</strong>
                        <span>
                          {h.role === 'driver' ? t.myRides.asDriver : `${t.myRides.asPassenger} · ${h.driver_name}`} · {shortCarName(h.car_name)}
                          {h.role === 'driver' && ` · ${t.myRides.pax(h.passengers)}`}
                          {h.distance_km != null && ` · ${h.distance_km} km`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            !error && <p className="hint">{t.common.loading}</p>
          )}
      </>
    </Sheet>
  )
}

/** The four figures, for this month or all time: one switch, one set of tiles. */
function Figures({ stats }: { stats: PersonStats }) {
  const t = useT()
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const bucket = period === 'month' ? stats.month : stats.all
  const tiles = [
    [bucket.rides_driven, t.myRides.driven, SteeringIcon],
    [bucket.rides_ridden, t.myRides.ridden, UserIcon],
    [bucket.people_carried, t.myRides.carried, PeopleIcon],
    [bucket.km_shared, t.myRides.km, RoadIcon],
  ] as const
  return (
    <section className="mr-figures">
      <div className="segmented" role="radiogroup" aria-label={t.myRides.period}>
        <SegThumb count={2} index={period === 'month' ? 0 : 1} />
        <button type="button" role="radio" aria-checked={period === 'month'} className={period === 'month' ? 'seg seg-on' : 'seg'} onClick={() => setPeriod('month')}>
          {t.myRides.thisMonth}
        </button>
        <button type="button" role="radio" aria-checked={period === 'all'} className={period === 'all' ? 'seg seg-on' : 'seg'} onClick={() => setPeriod('all')}>
          {t.myRides.allTime}
        </button>
      </div>
      {quiet(bucket) ? (
        <p className="mr-quiet">{period === 'month' ? t.myRides.quietMonth : t.myRides.quietAll}</p>
      ) : (
        <>
          <div className="mr-tiles">
            {tiles.map(([value, label, Icon], i) => (
              <div key={label} className={value ? 'mr-tile' : 'mr-tile is-zero'} style={{ '--i': i } as CSSProperties}>
                <span className="mr-tile-icon">
                  <Icon size={18} />
                </span>
                <strong className="when-value">
                  <CountUp value={Math.round(value)} />
                </strong>
                <span className="mr-tile-label">{label}</span>
              </div>
            ))}
          </div>
          <p className="hint">{t.myRides.kmHint}</p>
        </>
      )}
    </section>
  )
}

/** What your seats took off the road, all time: a floor, and an estimate. */
function Impact({ bucket }: { bucket: StatBucket }) {
  const t = useT()
  const carKm = Math.round(bucket.car_km_avoided)
  const runs = officeRuns(bucket.car_km_avoided)
  return (
    <section className="mr-impact-section">
      <h3 className="section-title">{t.myRides.impact}</h3>
      {carKm === 0 ? (
        <p className="mr-impact mr-impact-none">
          <LeafIcon size={20} /> <span>{t.myRides.impactNone}</span>
        </p>
      ) : (
        <>
          <div className="mr-impact">
            <div className="mr-impact-main">
              <LeafIcon size={22} />
              <strong className="when-value">
                <CountUp value={carKm} />
              </strong>
              <span>{t.myRides.carKm}</span>
            </div>
            {runs > 0 && <p className="mr-impact-runs">{t.myRides.impactRuns(runs)}</p>}
            <dl className="mr-impact-side">
              <div>
                <dt>{t.myRides.co2}</dt>
                <dd className="when-value">
                  <CountUp value={Math.round(bucket.co2_kg)} />
                </dd>
              </div>
              <div>
                <dt>
                  {t.myRides.fuel}
                  {bucket.fuel_rsd ? <small className="stat-sub">{t.myRides.fuelRsd(fmtRsd(bucket.fuel_rsd))}</small> : null}
                </dt>
                <dd className="when-value">
                  <CountUp value={Math.round(bucket.fuel_l)} />
                </dd>
              </div>
            </dl>
          </div>
          <p className="hint">{t.myRides.impactHint}</p>
        </>
      )}
    </section>
  )
}
