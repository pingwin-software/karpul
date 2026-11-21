import { describe, expect, it } from 'vitest'
import { aRide } from '../test/render'
import { canSayHere, hasLeft } from './pickup'

const at = (iso: string) => new Date(iso)
const ride = aRide({ ride_date: '2026-11-23', departure_time: '08:00:00' })

describe('canSayHere', () => {
  it('is from half an hour before departure to the end of the day', () => {
    expect(canSayHere(ride, at('2026-11-23T07:29:00'))).toBe(false)
    expect(canSayHere(ride, at('2026-11-23T07:30:00'))).toBe(true)
    expect(canSayHere(ride, at('2026-11-23T08:20:00'))).toBe(true)
    expect(canSayHere(ride, at('2026-11-23T23:59:00'))).toBe(true)
  })
  it('is never on another day', () => {
    expect(canSayHere(ride, at('2026-11-22T07:45:00'))).toBe(false)
    expect(canSayHere(ride, at('2026-11-24T07:45:00'))).toBe(false)
  })
})

describe('hasLeft', () => {
  it('turns at the departure time on the day', () => {
    expect(hasLeft(ride, at('2026-11-23T07:59:00'))).toBe(false)
    expect(hasLeft(ride, at('2026-11-23T08:00:00'))).toBe(true)
  })
  it('is true of every earlier day and false of every later one', () => {
    expect(hasLeft(ride, at('2026-11-24T00:01:00'))).toBe(true)
    expect(hasLeft(ride, at('2026-11-22T23:00:00'))).toBe(false)
  })
})
