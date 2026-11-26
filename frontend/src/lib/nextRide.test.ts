import { describe, expect, it } from 'vitest'
import { nextRide } from './nextRide'
import type { Me } from './me'
import type { Ride } from './types'

const me: Me = { id: 7, name: 'Marko Jovanović', admin: false }

function ride(over: Partial<Ride>): Ride {
  return {
    id: 1,
    ride_date: '2026-11-26',
    departure_time: '08:00:00',
    return_time: '16:30:00',
    driver_id: 1,
    driver_name: 'Ana Petrović',
    bookings: [],
    waitlist: [],
    ...over,
  } as Ride
}
const seat = { id: 1, passenger_id: 7, passenger_name: 'Marko Jovanović', pickup: '', created_at: '' }
const at = (hhmm: string) => new Date(`2026-11-26T${hhmm}:00`)

describe('nextRide', () => {
  it('is the first ride you drive or sit in, in board order', () => {
    const rides = [ride({ id: 1 }), ride({ id: 2, bookings: [seat] }), ride({ id: 3, driver_id: 7, driver_name: me.name, ride_date: '2026-11-27' })]
    expect(nextRide(rides, me, at('06:00'))?.id).toBe(2)
  })

  it('keeps today’s ride until it is back', () => {
    const rides = [ride({ id: 2, bookings: [seat] }), ride({ id: 3, driver_id: 7, driver_name: me.name, ride_date: '2026-11-27' })]
    expect(nextRide(rides, me, at('12:00'))?.id).toBe(2)
    expect(nextRide(rides, me, at('16:30'))?.id).toBe(3)
  })

  it('lets a one-way ride go once it has left', () => {
    const rides = [ride({ id: 2, bookings: [seat], return_time: null })]
    expect(nextRide(rides, me, at('07:59'))?.id).toBe(2)
    expect(nextRide(rides, me, at('08:00'))).toBeNull()
  })

  it('is nothing when you are in no ride', () => {
    expect(nextRide([ride({ id: 1 })], me, at('06:00'))).toBeNull()
  })
})
