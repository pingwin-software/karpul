import { describe, expect, it } from 'vitest'
import { BUS_FROM, officeRuns, quiet, rideRank } from './rideRank'
import type { StatBucket } from './types'

const bucket = (over: Partial<StatBucket> = {}): StatBucket => ({
  rides_driven: 0,
  rides_ridden: 0,
  people_carried: 0,
  km_shared: 0,
  car_km_avoided: 0,
  co2_kg: 0,
  fuel_l: 0,
  ...over,
})

describe('rideRank', () => {
  it('names an account by what it has done so far', () => {
    expect(rideRank(bucket())).toBe('parked')
    expect(rideRank(bucket({ rides_ridden: 4 }))).toBe('shotgun')
    expect(rideRank(bucket({ rides_driven: 2 }))).toBe('solo')
    expect(rideRank(bucket({ rides_driven: 2, people_carried: 3 }))).toBe('chauffeur')
    expect(rideRank(bucket({ rides_driven: 1, rides_ridden: 1, people_carried: 3 }))).toBe('both')
  })

  it('makes a bus line of whoever carried enough people, whatever else they did', () => {
    expect(rideRank(bucket({ rides_driven: 9, rides_ridden: 5, people_carried: BUS_FROM }))).toBe('bus')
    expect(rideRank(bucket({ rides_driven: 9, people_carried: BUS_FROM - 1 }))).toBe('chauffeur')
  })
})

describe('quiet', () => {
  it('is a period with nothing in any of the four figures', () => {
    expect(quiet(bucket())).toBe(true)
    expect(quiet(bucket({ rides_ridden: 1 }))).toBe(false)
    expect(quiet(bucket({ km_shared: 12 }))).toBe(false)
  })
})

describe('officeRuns', () => {
  it('counts whole drives between the offices', () => {
    expect(officeRuns(0)).toBe(0)
    expect(officeRuns(89.9)).toBe(0)
    expect(officeRuns(90)).toBe(1)
    expect(officeRuns(455)).toBe(5)
  })
})
