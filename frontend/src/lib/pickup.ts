import { useEffect, useState } from 'react'
import { toISODate } from './dates'
import type { Ride } from './types'

/**
 * On the day: when a passenger may say "I'm at the pickup point", and when the
 * driver may say who did not turn up (backend: routers/seats.py `at_pickup`,
 * `mark_no_show`). The server takes "I'm here" all day; the button only shows
 * once it can mean something.
 */

/** How long before departure *I'm at the pickup point* appears. */
export const HERE_BEFORE_MIN = 30

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function isToday(ride: Ride, now: Date = new Date()): boolean {
  return ride.ride_date === toISODate(now)
}

/** The ride's day, from half an hour before it leaves: someone further down the route is still waiting after that. */
export function canSayHere(ride: Ride, now: Date = new Date()): boolean {
  return isToday(ride, now) && now.getHours() * 60 + now.getMinutes() >= minutesOf(ride.departure_time) - HERE_BEFORE_MIN
}

/** The ride's departure has passed: only then can someone not have turned up. */
export function hasLeft(ride: Ride, now: Date = new Date()): boolean {
  const today = toISODate(now)
  if (ride.ride_date !== today) return ride.ride_date < today
  return now.getHours() * 60 + now.getMinutes() >= minutesOf(ride.departure_time)
}

/** The time, looked at again every half minute while `ticking`, so a button due at 07:30 shows up at 07:30. */
export function useClock(ticking: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [ticking])
  return now
}
