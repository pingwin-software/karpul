import { firstName, fmtDayLabel, fmtTime } from '../lib/dates'
import { useT } from '../lib/i18n'
import { drives, myBooking, useMe } from '../lib/me'
import { canSayHere, isToday, useClock } from '../lib/pickup'
import type { Ride } from '../lib/types'
import { ArrowRightIcon } from './icons'

interface Props {
  ride: Ride
  busy: boolean
  onOpen: () => void
  onHere: (ride: Ride, bookingId: number, here: boolean) => void
}

/**
 * The card on top of the list: the next ride you are part of, in the tint.
 * When, the way, and one line on who drives and where you get in. On the day,
 * from half an hour before it leaves, a passenger gets the one button that
 * matters then: *I'm at the pickup point* (the same call the ride's own screen
 * makes). The rest of the card opens the ride.
 */
export function NextRide({ ride, busy, onOpen, onHere }: Props) {
  const t = useT()
  const me = useMe()
  const now = useClock(isToday(ride))
  const driving = drives(ride, me)
  const booking = myBooking(ride, me)
  const sayHere = !driving && booking !== undefined && canSayHere(ride, now) && !booking.here_at && !booking.no_show
  const line = driving
    ? `${t.next.youDrive} ${t.next.inCar(ride.bookings.length)}`
    : `${t.next.drives(firstName(ride.driver_name))} ${t.next.getIn(booking?.pickup || ride.origin)}`
  return (
    <div className="next-ride">
      <button type="button" className="next-open" aria-label={`${t.next.open}: ${fmtTime(ride.departure_time)}, ${ride.origin}, ${ride.destination}`} onClick={onOpen}>
        <span className="next-cap">
          {t.next.label} · {fmtDayLabel(ride.ride_date)}
        </span>
        <span className="next-time">{fmtTime(ride.departure_time)}</span>
        <span className="next-route">
          {ride.origin}
          <ArrowRightIcon size={16} weight="bold" />
          {ride.destination}
        </span>
        <span className="next-line">{line}</span>
      </button>
      {sayHere && booking && (
        <button type="button" className="next-cta" disabled={busy} onClick={() => onHere(ride, booking.id, true)}>
          {t.detail.imHere}
        </button>
      )}
    </div>
  )
}
