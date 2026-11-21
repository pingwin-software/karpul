import { beforeEach, describe, expect, it } from 'vitest'
import { aRide } from '../test/render'
import type { Me } from './me'
import { comingRides, forgetOffline, loadSnapshot, mergeSnapshot, rememberRides } from './offline'

const ANA: Me = { id: 1, name: 'Ana Anić' }
const BOJAN: Me = { id: 2, name: 'Bojan Bojić' }
const NOW = new Date('2026-11-23T07:00:00')
const WEEK = { from: '2026-11-23', to: '2026-11-29' }
const NEXT = { from: '2026-11-30', to: '2026-12-06' }

const seat = (id: number, who: Me, pickup = '') => ({ id, passenger_id: who.id, passenger_name: who.name, pickup, created_at: '' })

describe('mergeSnapshot', () => {
  it('keeps only the rides you drive or sit in, cut down to the essentials', () => {
    const mine = aRide({ id: 1, ride_date: '2026-11-24', driver_phone: '+381 60 123', bookings: [seat(10, BOJAN, 'Bulevar 12')] })
    const someoneElses = aRide({ id: 2, ride_date: '2026-11-24', driver_id: 5, driver_name: 'Mila Milić' })
    const asDriver = mergeSnapshot(null, [mine, someoneElses], WEEK, ANA, NOW)
    expect(asDriver.rides).toEqual([
      expect.objectContaining({ id: 1, role: 'driver', pickup: '', passengers: [{ name: 'Bojan Bojić', pickup: 'Bulevar 12' }] }),
    ])
    const asPassenger = mergeSnapshot(null, [mine, someoneElses], WEEK, BOJAN, NOW)
    expect(asPassenger.rides).toEqual([
      expect.objectContaining({ id: 1, role: 'passenger', pickup: 'Bulevar 12', driver_phone: '+381 60 123', passengers: [] }),
    ])
    expect(asPassenger.savedAt).toBe(NOW.toISOString())
  })

  it('replaces what was known of the loaded days and leaves the rest', () => {
    const tuesday = aRide({ id: 1, ride_date: '2026-11-24' })
    const nextMonday = aRide({ id: 2, ride_date: '2026-11-30' })
    let snapshot = mergeSnapshot(null, [tuesday], WEEK, ANA, NOW)
    snapshot = mergeSnapshot(snapshot, [nextMonday], NEXT, ANA, NOW)
    expect(snapshot.rides.map((r) => r.id)).toEqual([1, 2])
    // Tuesday's ride is gone from the board (removed, or you got out).
    snapshot = mergeSnapshot(snapshot, [], WEEK, ANA, NOW)
    expect(snapshot.rides.map((r) => r.id)).toEqual([2])
  })

  it('does not keep a ride twice when it moved into the loaded days', () => {
    const snapshot = mergeSnapshot(null, [aRide({ id: 1, ride_date: '2026-11-30' })], NEXT, ANA, NOW)
    const moved = mergeSnapshot(snapshot, [aRide({ id: 1, ride_date: '2026-11-25' })], WEEK, ANA, NOW)
    expect(moved.rides.map((r) => [r.id, r.ride_date])).toEqual([[1, '2026-11-25']])
  })

  it('drops the days gone by and puts the next ride first', () => {
    const rides = [
      aRide({ id: 3, ride_date: '2026-11-25', departure_time: '16:00' }),
      aRide({ id: 2, ride_date: '2026-11-25', departure_time: '07:30' }),
      aRide({ id: 1, ride_date: '2026-11-23', departure_time: '07:30' }),
    ]
    const snapshot = mergeSnapshot(null, rides, WEEK, ANA, NOW)
    expect(snapshot.rides.map((r) => r.id)).toEqual([1, 2, 3])
    expect(comingRides(snapshot, new Date('2026-11-25T12:00:00')).map((r) => r.id)).toEqual([2, 3])
    expect(comingRides(null)).toEqual([])
  })
})

describe('the copy in this browser', () => {
  beforeEach(() => {
    localStorage.clear()
    forgetOffline()
  })

  it('is per account and goes on sign-out', () => {
    rememberRides([aRide({ id: 1, ride_date: '2026-11-24' })], WEEK, ANA, NOW)
    expect(loadSnapshot(ANA.id)?.rides.map((r) => r.id)).toEqual([1])
    expect(loadSnapshot(BOJAN.id)).toBeNull()
    expect(JSON.parse(localStorage.getItem('karpul.offline.1')!).rides).toHaveLength(1)
    forgetOffline()
    expect(localStorage.getItem('karpul.offline.1')).toBeNull()
    expect(loadSnapshot(ANA.id)).toBeNull()
  })

  it('reads nothing from a copy that is not one', () => {
    localStorage.setItem('karpul.offline.1', '{"rides": "no"}')
    expect(loadSnapshot(ANA.id)).toBeNull()
  })
})
