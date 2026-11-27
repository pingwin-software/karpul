import { addDays, parseISODate, toISODate, todayISO } from './dates'
import { inRide, type Me } from './me'
import type { Ride } from './types'

/**
 * Which ride is open, and which days are loaded (App.tsx). Plain functions
 * of the board, so the rules can be read in one place and tested.
 */

/** The three places, in tab order: the rides ahead, the shared cars' day, and your own corner. */
export type View = 'upcoming' | 'day' | 'you'
export const VIEWS: View[] = ['upcoming', 'day', 'you']
/** How far ahead the upcoming list looks. The API caps a range at 92 days. */
export const UPCOMING_DAYS = 90

/** The days a view needs: the one day of the plan, else the next UPCOMING_DAYS (*You* keeps the list loaded). */
export function boardRange(view: View, selected: string): { from: string; to: string } {
  if (view === 'day') return { from: selected, to: selected }
  const today = parseISODate(todayISO())
  return { from: toISODate(today), to: toISODate(addDays(today, UPCOMING_DAYS)) }
}

/**
 * The open row in the upcoming list: only an explicit tap opens one; side by
 * side on a wide screen the pane is never empty, so with nothing picked it
 * shows your next ride, else the first.
 */
export function upcomingSelection(picked: number | null, rides: Ride[], me: Me, wide: boolean): number | null {
  if (picked !== null && rides.some((r) => r.id === picked)) return picked
  if (!wide) return null
  return rides.find((r) => inRide(r, me))?.id ?? rides[0]?.id ?? null
}
