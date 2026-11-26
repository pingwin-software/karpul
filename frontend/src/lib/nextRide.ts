import { toISODate } from './dates'
import { inRide, type Me } from './me'
import type { Ride } from './types'

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * The next ride you are part of (driving or seated), for the card on top of
 * the list: the first in board order that is not over. Today's ride counts
 * until it is back (its return, or its departure when it has none), so the
 * card stays up through the day you are on the road.
 */
export function nextRide(rides: Ride[], me: Me, now: Date = new Date()): Ride | null {
  const today = toISODate(now)
  const clock = now.getHours() * 60 + now.getMinutes()
  for (const r of rides) {
    if (!inRide(r, me)) continue
    if (r.ride_date < today) continue
    if (r.ride_date === today && clock >= minutesOf(r.return_time ?? r.departure_time)) continue
    return r
  }
  return null
}
