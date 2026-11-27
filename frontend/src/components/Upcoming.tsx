import { fmtDayDate, fmtDayLabel, fmtTime, shortCarName } from '../lib/dates'
import { useKept } from '../lib/keep'
import { useT } from '../lib/i18n'
import { drives, hasSeatFor, seatedIn, useMe } from '../lib/me'
import { nextRide } from '../lib/nextRide'
import type { Ride, RideRequest } from '../lib/types'
import { ArrowRightIcon, CheckIcon, FilterIcon, SearchIcon, XIcon } from './icons'
import { Menu } from './Menu'
import { NextRide } from './NextRide'
import { RequestList } from './RequestList'
import { allStops } from '../lib/stops'

type Filter = 'all' | 'free' | 'mine' | 'joined'
const FILTERS: Filter[] = ['all', 'free', 'mine', 'joined']

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

interface Props {
  /** Every ride from today on, in the API's order (date, departure, id). */
  rides: Ride[]
  /** The open requests in the same days, in board order. */
  requests: RideRequest[]
  busy: boolean
  onOffer: (request: RideRequest) => void
  onWithdraw: (request: RideRequest) => void
  /** *I'm at the pickup point*, from the card on top. */
  onHere: (ride: Ride, bookingId: number, here: boolean) => void
  /** The open ride: on its own screen on a phone, in the pane beside the list on a wide screen. */
  openId: number | null
  onOpen: (rideId: number | null) => void
  /** A row opens its ride on a screen of its own (RidePage, on a phone). */
  opensPage?: boolean
}

/**
 * The rides ahead as one quiet list: your next ride as a card on top, then a
 * group per day with a row per ride (when, the way, who drives, and how it
 * stands for you), then who is still looking for a ride that day. Everything
 * else about a ride is on its own screen: tapping a row opens it, on a screen
 * of its own on a phone and beside the list on a wide screen.
 */
export function Upcoming({ rides, requests, busy, onOffer, onWithdraw, onHere, openId, onOpen, opensPage = false }: Props) {
  const t = useT()
  const me = useMe()
  // Filters live here: they are a way of looking at the list, not board state.
  const [filter, setFilter] = useKept<Filter>('upcoming.filter', 'all')
  const [query, setQuery] = useKept('upcoming.query', '')
  const q = fold(query.trim())
  const matches = (r: Ride) => {
    if (filter === 'free' && !hasSeatFor(r, me)) return false
    if (filter === 'mine' && !drives(r, me)) return false
    if (filter === 'joined' && !seatedIn(r, me)) return false
    if (q && !fold(`${r.origin} ${r.destination} ${r.driver_name} ${r.car_name} ${allStops(r).join(' ')}`).includes(q)) return false
    return true
  }
  const shown = rides.filter(matches)
  // Requests belong to "All": the other filters are about seats, yours or free.
  const asks =
    filter === 'all' ? requests.filter((r) => !q || fold(`${r.origin} ${r.destination} ${r.name} ${r.note}`).includes(q)) : []
  const filtered = filter !== 'all' || q !== ''
  const byDay = new Map<string, { rides: Ride[]; asks: RideRequest[] }>()
  const day = (date: string) => {
    let d = byDay.get(date)
    if (!d) byDay.set(date, (d = { rides: [], asks: [] }))
    return d
  }
  for (const r of shown) day(r.ride_date).rides.push(r)
  for (const r of asks) day(r.request_date).asks.push(r)
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }))
  const next = filtered ? null : nextRide(rides, me)

  return (
    <section className="upcoming" aria-label={t.upcoming.label}>
      {next && <NextRide ride={next} busy={busy} onOpen={() => onOpen(next.id)} onHere={onHere} />}

      <div className="list-tools">
        <label className="input-icon search">
          <SearchIcon size={16} />
          <input type="search" placeholder={t.filters.search} aria-label={t.filters.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" className="icon-btn icon-btn-sm input-clear" aria-label={t.common.close} onClick={() => setQuery('')}>
              <XIcon size={16} />
            </button>
          )}
        </label>
        <Menu
          className={filter === 'all' ? 'list-filter' : 'list-filter list-filter-on'}
          trigger={<FilterIcon size={18} />}
          label={t.filters.filter}
          items={FILTERS.map((f) => ({
            label: t.filters[f],
            icon: filter === f ? <CheckIcon size={16} /> : <span className="menu-gap" />,
            onSelect: () => setFilter(f),
          }))}
        />
      </div>
      {filter !== 'all' && (
        <button type="button" className="chip chip-on chip-clear" onClick={() => setFilter('all')}>
          {t.filters[filter]}
          <XIcon size={14} />
        </button>
      )}

      {days.length === 0 && filtered && (
        <div className="card empty-card empty-card-short">
          <strong>{t.filters.noMatch}</strong>
          <button
            type="button"
            className="link"
            onClick={() => {
              setFilter('all')
              setQuery('')
            }}
          >
            {t.filters.clear}
          </button>
        </div>
      )}

      {days.map((day) => (
        <div key={day.date} className="upcoming-day">
          <h3 className="section-title upcoming-head">
            <span className="upcoming-day-name">{fmtDayLabel(day.date)}</span>
            <span className="section-count">{fmtDayDate(day.date)}</span>
          </h3>
          {day.rides.length > 0 && (
            <ul className="group session-list">
              {day.rides.map((r) => {
                const open = r.id === openId
                const driving = drives(r, me)
                const riding = seatedIn(r, me)
                const full = r.free_seats <= 0
                const time = fmtTime(r.departure_time)
                // What needs someone's attention, said once under the driver.
                const flag = r.needs_driver
                  ? t.upcoming.needsDriver
                  : r.approval === 'pending'
                    ? t.upcoming.awaiting
                    : r.unconfirmed
                      ? t.upcoming.unconfirmed
                      : r.proposal
                        ? t.upcoming.changeAsked
                        : null
                const state = driving ? t.upcoming.driving : riding ? t.upcoming.youreIn : full ? t.upcoming.full : t.upcoming.seats(r.free_seats)
                const cls = ['group-row', 'session', open && 'session-open', (driving || riding) && 'session-mine'].filter(Boolean).join(' ')
                return (
                  <li key={r.id} className="session-item">
                    <button
                      type="button"
                      className={cls}
                      aria-label={`${t.upcoming.row(time, r.origin, r.destination, r.driver_name, shortCarName(r.car_name))}, ${flag ? `${flag}, ` : ''}${state}`}
                      aria-haspopup={opensPage ? 'dialog' : undefined}
                      aria-expanded={opensPage ? open : undefined}
                      aria-current={!opensPage && open ? 'true' : undefined}
                      onClick={() => onOpen(open ? null : r.id)}
                    >
                      <span className="session-time when-value">{time}</span>
                      <span className="group-text">
                        <strong className="session-route">
                          {r.origin}
                          <ArrowRightIcon size={14} className="session-arrow" />
                          {r.destination}
                        </strong>
                        <small>{driving ? t.upcoming.you : r.driver_name}</small>
                        {flag && <small className="session-flag">{flag}</small>}
                      </span>
                      <span className={driving || riding ? 'session-state session-state-mine' : full ? 'session-state session-state-full' : 'session-state'}>{state}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <RequestList requests={day.asks} isPast={false} busy={busy} onOffer={onOffer} onWithdraw={onWithdraw} />
        </div>
      ))}
    </section>
  )
}
