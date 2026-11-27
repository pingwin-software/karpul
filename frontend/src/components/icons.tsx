import type { CSSProperties, ReactNode, SVGProps } from 'react'
import { ION, type IonName } from './ionicons.gen'

/**
 * The app's icons: glyphs from Ionicons (MIT), the open set drawn to sit beside
 * iOS, in `currentColor`. The data is `ionicons.gen.ts`, written by
 * `scripts/gen-icons.mjs` with only the glyphs named there, so the names
 * exported below stay the contract the components render against: to change a
 * drawing, change which glyph a name points at (and add it to the script).
 * Every icon takes `size` (px) and an optional `weight`. The drawer and the tab
 * bar use the two-style marks in NavIcon.tsx.
 */
type IconWeight = 'light' | 'regular' | 'bold'
type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth' | 'name'> & {
  size?: number
  weight?: IconWeight
  /** A heavier line for one use (2.25 and up reads as bold). */
  strokeWidth?: number
}

/** The line of an outline glyph, in its 512-unit grid (32 is the set's own). */
const LINE: Record<IconWeight, number> = { light: 28, regular: 32, bold: 44 }

/**
 * A 512-unit drawing shown at 12px thins every line to under a pixel, so small
 * icons get a heavier one. Filled glyphs have no line and ignore this.
 */
function line(size: number, weight: IconWeight): number {
  const base = LINE[weight]
  if (size <= 13) return base * 1.4
  if (size <= 16) return base * 1.2
  return base
}

/** One glyph as an `<svg>`: the markup is the set's own, written at build time. */
export function Glyph({ name, size = 20, weight = 'regular', children, style, className, ...rest }: Omit<IconProps, 'strokeWidth'> & { name: IonName; children?: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className ? `ion ${className}` : 'ion'}
      style={{ '--ion-line': `${line(size, weight)}px`, ...style } as CSSProperties}
      {...rest}
    >
      <g dangerouslySetInnerHTML={{ __html: ION[name] }} />
      {children}
    </svg>
  )
}

function icon(name: IonName, extra?: ReactNode) {
  return ({ weight, strokeWidth, ...rest }: IconProps) => (
    <Glyph name={name} weight={weight ?? (strokeWidth !== undefined && strokeWidth >= 2.25 ? 'bold' : 'regular')} {...rest}>
      {extra}
    </Glyph>
  )
}

/** The generic car: the fallback for a car the board cannot draw. */
export const CarIcon = icon('car-sport-outline')
/** The same car: the vehicle pool. */
export const CarProfileIcon = icon('car-sport-outline')
/** Electric. */
export const BoltIcon = icon('flash')
/** A hybrid. */
export const LeafIcon = icon('leaf')
/** Petrol. */
export const PumpIcon = icon('flame')
/** Diesel. */
export const DropIcon = icon('water')
export const PlusIcon = icon('add')
export const MinusIcon = icon('remove')
export const MenuIcon = icon('menu')
/** More: three dots in a row, as iOS draws them. */
export const KebabIcon = icon('ellipsis-horizontal')
export const ChevronLeftIcon = icon('chevron-back')
export const ChevronRightIcon = icon('chevron-forward')
export const ChevronDownIcon = icon('chevron-down')
export const ChevronUpIcon = icon('chevron-up')
/** From here to there, in a route. */
export const ArrowRightIcon = icon('arrow-forward')
/** Back: a chevron, as iOS draws it. */
export const ArrowLeftIcon = icon('chevron-back')
export const PinIcon = icon('location-outline')
export const MapIcon = icon('map-outline')
export const NavigateIcon = icon('navigate-outline')
export const LocateIcon = icon('locate-outline')
export const GripIcon = icon('reorder-two-outline')
export const TrashIcon = icon('trash-outline')
export const PencilIcon = icon('pencil-outline')
export const CopyIcon = icon('copy-outline')
export const XIcon = icon('close')
export const CheckIcon = icon('checkmark')
export const CheckCircleIcon = icon('checkmark-circle-outline')
export const CalendarIcon = icon('calendar-outline')
export const ListIcon = icon('list-outline')
export const ClockIcon = icon('time-outline')
export const TimelineIcon = icon('options-outline')
export const UserIcon = icon('person-outline')
export const UsersIcon = icon('people-outline')
export const LogoutIcon = icon('log-out-outline')
export const KeyIcon = icon('key-outline')
export const SearchIcon = icon('search-outline')
export const InfoIcon = icon('information-circle-outline')
export const ShareIcon = icon('share-outline')
export const RepeatIcon = icon('repeat-outline')
/** Whoever drives. */
export const SteeringIcon = icon('car-sport-outline')
/** Distance and the odometer. */
export const RoadIcon = icon('speedometer-outline')
export const CoinsIcon = icon('cash-outline')
export const PhoneIcon = icon('call-outline')
export const MailIcon = icon('mail-outline')
export const BellIcon = icon('notifications-outline')
export const ChartIcon = icon('bar-chart-outline')
export const FilterIcon = icon('funnel-outline')
export const SunIcon = icon('sunny-outline')
export const MoonIcon = icon('moon-outline')
/** Your rides. */
export const RouteIcon = icon('trail-sign-outline')
/** The office garage. */
export const GarageIcon = icon('business-outline')
export const TableIcon = icon('grid-outline')
/** Charging. */
export const PlugIcon = icon('battery-charging-outline')
export const LifebuoyIcon = icon('help-buoy-outline')
export const BugIcon = icon('bug-outline')
export const PeopleIcon = icon('people-outline')
export const MessageIcon = icon('chatbubble-outline')
export const SendIcon = icon('send')
/** Asking for a ride. */
export const HandIcon = icon('hand-left-outline')
export const CoffeeIcon = icon('cafe-outline')
export const HourglassIcon = icon('hourglass-outline')
export const DownloadIcon = icon('download-outline')
export const ApprovalIcon = icon('clipboard-outline')
export const AdminLogIcon = icon('shield-outline')
export const ShieldIcon = icon('shield-checkmark-outline')
export const WrenchIcon = icon('build-outline')
/** The bell with something waiting: a dot in the accent's place, top right. */
export const BellDotIcon = icon('notifications-outline', <circle cx="392" cy="112" r="64" />)
