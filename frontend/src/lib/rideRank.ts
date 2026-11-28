import type { StatBucket } from './types'

/**
 * The playful side of *Your rides*: the title an account has earned from its
 * all-time figures, whether a period has anything to show, and how many
 * office-to-office drives the saved car kilometres come to. Pure, so the
 * sheet only draws.
 */
export type RideRank = 'parked' | 'shotgun' | 'solo' | 'chauffeur' | 'both' | 'bus'

/** People carried, all time, from which one driver counts as public transport. */
export const BUS_FROM = 20

/** Beograd to Novi Sad, the road most rides take (lib/offices.ts). */
export const OFFICE_RUN_KM = 90

export function rideRank(all: StatBucket): RideRank {
  if (all.people_carried >= BUS_FROM) return 'bus'
  if (all.rides_driven > 0 && all.rides_ridden > 0) return 'both'
  if (all.rides_driven > 0) return all.people_carried > 0 ? 'chauffeur' : 'solo'
  if (all.rides_ridden > 0) return 'shotgun'
  return 'parked'
}

/** Nothing driven, ridden, carried or shared in this period. */
export function quiet(bucket: StatBucket): boolean {
  return bucket.rides_driven === 0 && bucket.rides_ridden === 0 && bucket.people_carried === 0 && bucket.km_shared === 0
}

/** How many whole Beograd to Novi Sad drives the saved car kilometres make. */
export function officeRuns(carKm: number): number {
  return Math.floor(carKm / OFFICE_RUN_KM)
}
