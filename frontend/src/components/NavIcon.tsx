import type { SVGProps } from 'react'
import { Glyph } from './icons'
import type { IonName } from './ionicons.gen'

/* --- Navigation marks ------------------------------------------------------
   The drawer's items and the tab bar: each mark is a pair of Ionicons glyphs,
   the outline one (`regular`, the default, the drawer) and its filled twin
   (`filled`, a selected tab), both in `currentColor`. */
const MARKS = {
  route: ['trail-sign-outline', 'trail-sign'],
  bell: ['notifications-outline', 'notifications'],
  plug: ['battery-charging-outline', 'battery-charging'],
  book: ['book-outline', 'book'],
  lifebuoy: ['help-buoy-outline', 'help-buoy'],
  sparkle: ['sparkles-outline', 'sparkles'],
  bug: ['bug-outline', 'bug'],
  approvals: ['clipboard-outline', 'clipboard'],
  car: ['car-sport-outline', 'car-sport'],
  garage: ['business-outline', 'business'],
  people: ['people-outline', 'people'],
  person: ['person-outline', 'person'],
  map: ['map-outline', 'map'],
  table: ['grid-outline', 'grid'],
  log: ['shield-outline', 'shield'],
  install: ['download-outline', 'download'],
  list: ['list-outline', 'list'],
  calendar: ['calendar-outline', 'calendar'],
  settings: ['settings-outline', 'settings'],
  clock: ['time-outline', 'time'],
  key: ['key-outline', 'key'],
  hand: ['hand-left-outline', 'hand-left'],
  search: ['search-outline', 'search'],
} as const satisfies Record<string, readonly [IonName, IonName]>

export type NavName = keyof typeof MARKS
export type NavVariant = 'regular' | 'filled'

interface NavProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'strokeWidth'> {
  name: NavName
  variant?: NavVariant
  size?: number
}

/** One navigation mark in one of its two styles. */
export function NavIcon({ name, variant = 'regular', size = 20, ...rest }: NavProps) {
  return <Glyph name={MARKS[name][variant === 'filled' ? 1 : 0]} size={size} {...rest} />
}
