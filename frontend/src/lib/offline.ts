import { useSyncExternalStore } from 'react'
import { toISODate } from './dates'
import { drives, inRide, myBooking, type Me } from './me'
import type { Ride } from './types'
import type { Range } from './useBoard'

/**
 * Your coming rides, kept in this browser for when there is no signal: the
 * garage, the roadside, the lift. The service worker already opens the app
 * with no network (docs/features/pwa.md), but the board is the API's, and the
 * API is never cached; so each time the board loads, the rides you drive or
 * sit in are written to localStorage (`karpul.offline.<account>`), cut down
 * to what you need standing at a pickup point: when, where, who drives, their
 * number, who else is in the car. When the board cannot be reached, `App`
 * shows them in `OfflineCard`, saying how old they are.
 *
 * The copy is only ever what the board last showed, so it is merged by range:
 * a load of some days replaces what was known of those days and leaves the
 * rest. `App` also asks for the next two weeks once on start, so the copy
 * holds Monday's ride on a Sunday. It belongs to one account and goes when
 * that account signs out (lib/auth.ts).
 */

export interface OfflineRide {
  id: number
  ride_date: string
  departure_time: string
  return_time: string | null
  origin: string
  destination: string
  car_name: string
  driver_name: string
  driver_phone: string | null
  role: 'driver' | 'passenger'
  /** Where you get in, when you are a passenger. */
  pickup: string
  /** Everyone else in the car, with where each gets in. */
  passengers: { name: string; pickup: string }[]
}

export interface OfflineSnapshot {
  /** When the board was last seen, as an ISO instant. */
  savedAt: string
  rides: OfflineRide[]
}

export const OFFLINE_PREFIX = 'karpul.offline.'
/** How far ahead `App` looks once on start, whatever is on screen. */
export const OFFLINE_DAYS = 14
const key = (userId: number) => `${OFFLINE_PREFIX}${userId}`

function trim(ride: Ride, me: Me): OfflineRide {
  const mine = myBooking(ride, me)
  return {
    id: ride.id,
    ride_date: ride.ride_date,
    departure_time: ride.departure_time,
    return_time: ride.return_time,
    origin: ride.origin,
    destination: ride.destination,
    car_name: ride.car_name,
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone ?? null,
    role: drives(ride, me) ? 'driver' : 'passenger',
    pickup: mine ? mine.pickup || ride.origin : '',
    passengers: ride.bookings.filter((b) => b !== mine).map((b) => ({ name: b.passenger_name, pickup: b.pickup || ride.origin })),
  }
}

const inOrder = (a: OfflineRide, b: OfflineRide) =>
  a.ride_date.localeCompare(b.ride_date) || a.departure_time.localeCompare(b.departure_time) || a.id - b.id

/**
 * What is known after the board showed `rides` for `range`: your rides in
 * those days are exactly the ones in it, the days outside it stay as they
 * were, and anything before `today` is dropped.
 */
export function mergeSnapshot(prev: OfflineSnapshot | null, rides: Ride[], range: Range, me: Me, now: Date = new Date()): OfflineSnapshot {
  const today = toISODate(now)
  const seen = rides.filter((r) => r.ride_date >= range.from && r.ride_date <= range.to && inRide(r, me)).map((r) => trim(r, me))
  const ids = new Set(seen.map((r) => r.id))
  // A ride that moved into the range from a day outside it is the new one, not both.
  const kept = (prev?.rides ?? []).filter((r) => (r.ride_date < range.from || r.ride_date > range.to) && !ids.has(r.id))
  return { savedAt: now.toISOString(), rides: [...kept, ...seen].filter((r) => r.ride_date >= today).sort(inOrder) }
}

/** The snapshot's rides that have not gone by: from today on, the next first. */
export function comingRides(snapshot: OfflineSnapshot | null, now: Date = new Date()): OfflineRide[] {
  const today = toISODate(now)
  return (snapshot?.rides ?? []).filter((r) => r.ride_date >= today).sort(inOrder)
}

function isSnapshot(v: unknown): v is OfflineSnapshot {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<OfflineSnapshot>
  return typeof s.savedAt === 'string' && Array.isArray(s.rides)
}

// One snapshot in memory, of the account that last read or wrote it, so
// `useOfflineSnapshot` hands React the same object until it changes.
let cached: { userId: number; snapshot: OfflineSnapshot | null } | null = null
const listeners = new Set<() => void>()

export function loadSnapshot(userId: number): OfflineSnapshot | null {
  if (cached?.userId === userId) return cached.snapshot
  let snapshot: OfflineSnapshot | null = null
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? 'null')
    if (isSnapshot(parsed)) snapshot = parsed
  } catch {
    /* unreadable: as good as none */
  }
  cached = { userId, snapshot }
  return snapshot
}

function store(userId: number, snapshot: OfflineSnapshot) {
  cached = { userId, snapshot }
  try {
    localStorage.setItem(key(userId), JSON.stringify(snapshot))
  } catch {
    /* private mode, or full: this session still has it in memory */
  }
  listeners.forEach((fn) => fn())
}

/** The board showed `rides` for `range`: remember yours. */
export function rememberRides(rides: Ride[], range: Range, me: Me, now: Date = new Date()) {
  store(me.id, mergeSnapshot(loadSnapshot(me.id), rides, range, me, now))
}

/** Drop every account's copy from this browser (signing out). */
export function forgetOffline() {
  cached = null
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(OFFLINE_PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    /* nothing kept, nothing to drop */
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useOfflineSnapshot(userId: number): OfflineSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => loadSnapshot(userId),
    () => null,
  )
}
