import type { Ride } from './types'
import { sameName } from './dates'

/** Someone with an account, as anyone signed in may see them (backend: routers/people.py). */
export interface Person {
  id: number
  display_name: string
  /** An admin (by the flag or by `KARPUL_ADMINS`): shared-car mails go to them. */
  is_admin?: boolean
}

/** Lower case without the accents, so "jovic" finds "Jović". */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Who can still be put in `ride`: everyone with an account but the driver and
 * whoever already has a seat, matching `query` anywhere in the name.
 */
export function addable(people: Person[], ride: Ride, query: string): Person[] {
  const q = fold(query.trim())
  const taken = (p: Person) =>
    p.id === ride.driver_id ||
    sameName(p.display_name, ride.driver_name) ||
    ride.bookings.some((b) => b.passenger_id === p.id || (b.passenger_id === null && sameName(b.passenger_name, p.display_name)))
  return people.filter((p) => !taken(p) && (!q || fold(p.display_name).includes(q)))
}

/**
 * Who an admin may put at the wheel of a shared car whose driver cancelled:
 * everyone with an account but the driver who gave it up, passengers in it
 * included (backend: routers/drivers.pick_driver), passengers first.
 */
export function drivable(people: Person[], ride: Ride, query: string): Person[] {
  const q = fold(query.trim())
  const seated = (p: Person) => ride.bookings.some((b) => b.passenger_id === p.id)
  return people
    .filter((p) => p.id !== ride.driver_id && (!q || fold(p.display_name).includes(q)))
    .sort((a, b) => Number(seated(b)) - Number(seated(a)))
}

/** The passengers a shared car may be handed to (backend: give_car): an account, and in the car. */
export function givable(ride: Ride) {
  return ride.bookings.filter((b) => b.passenger_id != null && !b.no_show)
}
