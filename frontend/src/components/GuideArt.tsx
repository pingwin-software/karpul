import type { GuideArtKey } from '../lib/i18n'
import { CarArt } from './CarArt'

/**
 * One picture per entry of the shared car guide (CarGuide.tsx): the flap and
 * the charger, the card on the reader, the plug, the stalk, the P button, the
 * 80% battery, the frunk and so on. Drawn flat, like the cars on the board
 * (`CarArt`, which the first picture borrows): solid shapes with round
 * corners, no outlines and no shading, in a 120x80 box. The colours are the
 * classes of `.guide-art` in styles/sheets.css: `p` paper (what is white on the
 * real thing), `b` and `d` two greys, `k` the dark of a screen or a tyre, `a`
 * the green of the one thing the step is about, so a reader can find it on the
 * real car from the picture alone; `l` and `al` are the grey and green lines
 * of a cable or an arrow, `gl` and `pl` lines on a dark surface. Nothing here
 * is text that needs translating: the few letters (P, R, D, READY, 80%) are
 * what the car itself shows.
 */

interface ArtProps {
  /** Rendered width in px; the height is 2/3 of it. */
  width?: number
  className?: string
}

/** The charging card: green, with a pale chip, tilted a little. */
function Card({ x, y, w = 30, tilt = -8 }: { x: number; y: number; w?: number; tilt?: number }) {
  const h = w * 0.64
  return (
    <g transform={`rotate(${tilt} ${x + w / 2} ${y + h / 2})`}>
      <rect className="a" x={x} y={y} width={w} height={h} rx={w * 0.12} />
      <rect className="on" x={x + w * 0.14} y={y + h * 0.3} width={w * 0.24} height={h * 0.3} rx={w * 0.05} opacity="0.85" />
    </g>
  )
}

/** A numbered disc for a two-step picture. */
function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle className="a" cx={x} cy={y} r="7" />
      <text className="on" x={x} y={y + 3.2} textAnchor="middle">
        {n}
      </text>
    </g>
  )
}

/** Done: a tick on the same disc. */
function Tick({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle className="a" cx={x} cy={y} r="9" />
      <path className="ol" d={`M${x - 4} ${y}l3 3l5-6`} />
    </g>
  )
}

function ParkFlap() {
  return (
    <>
      <rect className="d" x="0" y="62" width="120" height="2" rx="1" opacity="0.4" />
      {/* the charger post, its screen and its cable to the flap */}
      <rect className="p" x="99" y="16" width="17" height="46" rx="5" />
      <rect className="k" x="102.5" y="21" width="10" height="9" rx="2" />
      <circle className="a" cx="107.5" cy="37" r="1.8" />
      <g transform="translate(1 33)">
        <CarArt model="mazda6e" width={88} />
      </g>
      <path className="l" d="M99 46C91 46 91 57 84 54C80 52 79 50 77 49" />
      {/* the flap on the rear quarter, ringed so it is the thing to look for */}
      <rect className="a" x="72.5" y="46.5" width="5" height="4" rx="1.2" />
      <circle className="al" cx="75" cy="48.5" r="7.5" strokeDasharray="2.6 3" />
    </>
  )
}

function CardReader() {
  return (
    <>
      <rect className="p" x="42" y="6" width="46" height="68" rx="9" />
      <rect className="k" x="49" y="13" width="32" height="17" rx="4" />
      <rect className="gf" x="53" y="19" width="14" height="3" rx="1.5" />
      <rect className="as" x="51" y="38" width="28" height="24" rx="6" />
      <circle className="a" cx="59" cy="50" r="1.9" />
      <path className="al" d="M63.5 45.5a6 6 0 0 1 0 9M68 42a11 11 0 0 1 0 16" />
      <Card x={9} y={41} w={34} />
      <Tick x={103} y={20} />
    </>
  )
}

/** A CCS socket in its recess: two pins over an oval with two more. */
function Socket({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect className="k" x="0" y="0" width="30" height="40" rx="8" />
      <circle className="p" cx="9" cy="11" r="3.2" />
      <circle className="p" cx="21" cy="11" r="3.2" />
      <rect className="d" x="5" y="20" width="20" height="13" rx="6.5" />
      <circle className="p" cx="11" cy="26.5" r="2.6" />
      <circle className="p" cx="19" cy="26.5" r="2.6" />
    </g>
  )
}

/** The plug, nozzle to the right, its cable trailing off below. */
function Plug({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="l" strokeWidth="3.2" d="M2 11C-9 11 -10 30 0 40" />
      <rect className="d" x="24" y="4" width="15" height="14" rx="3.5" />
      <rect className="k" x="0" y="0" width="27" height="22" rx="7" />
    </g>
  )
}

function PlugIn() {
  return (
    <>
      <rect className="p" x="72" y="8" width="56" height="64" rx="9" />
      <Socket x={80} y={20} />
      <circle className="a" cx="95" cy="14" r="2" />
      <Plug x={10} y={30} />
      <path className="al" d="M54 41H67M62.5 36.5l4.5 4.5l-4.5 4.5" />
    </>
  )
}

function CardThenUnplug() {
  return (
    <>
      <rect className="p" x="24" y="12" width="27" height="56" rx="7" />
      <rect className="k" x="28.5" y="17" width="18" height="11" rx="2.5" />
      <rect className="as" x="29.5" y="34" width="16" height="14" rx="4" />
      <Card x={8} y={42} w={21} tilt={-10} />
      <Badge x={12} y={18} n={1} />
      <rect className="p" x="97" y="12" width="30" height="56" rx="7" />
      <Socket x={102} y={26} s={0.7} />
      <Plug x={66} y={33} s={0.72} />
      <path className="al" d="M92 23H76M80.5 18.5l-4.5 4.5l4.5 4.5" />
      <Badge x={64} y={18} n={2} />
    </>
  )
}

function CardBack() {
  return (
    <>
      {/* the dashboard, the glovebox open under it and the card going in */}
      <path className="b" d="M-4 16Q60 2 124 12V46H-4Z" />
      <rect className="k" x="30" y="36" width="60" height="24" rx="5" />
      <path className="d" d="M30 60H90L95 71Q95.5 73 93.5 73H26.5Q24.5 73 25 71Z" />
      <Card x={48} y={40} w={24} tilt={8} />
      <path className="al" d="M60 12V28M55.5 23.5l4.5 4.5l4.5-4.5" />
    </>
  )
}

function NoStartButton() {
  return (
    <>
      <rect className="k" x="16" y="8" width="88" height="32" rx="9" />
      <text className="glow big" x="60" y="28" textAnchor="middle">
        READY
      </text>
      <path className="al" d="M40 44V54M36 50l4 4l4-4" />
      {/* the brake pedal */}
      <rect className="d" x="22" y="56" width="36" height="18" rx="5" />
      <path className="pl" d="M29 62H51M29 68H51" opacity="0.55" />
      {/* the start button that is not there */}
      <circle className="b" cx="88" cy="60" r="11" />
      <circle className="p" cx="88" cy="60" r="6.5" opacity="0.7" />
      <path className="l" strokeWidth="2.6" d="M78 50L98 70" />
    </>
  )
}

function Stalk() {
  return (
    <>
      <circle className="rim" cx="38" cy="42" r="24" />
      <path className="rim" strokeWidth="5" d="M16 42H30M46 42H60M38 50V64" />
      <circle className="d" cx="38" cy="42" r="9" />
      {/* the selector stalk on the right, with the P button on its tip */}
      <rect className="b" x="60" y="35" width="32" height="8" rx="4" />
      <circle className="a" cx="97" cy="39" r="8" />
      <text className="on" x="97" y="42.2" textAnchor="middle">
        P
      </text>
      <path className="al" d="M76 30V17M71.5 21.5l4.5-4.5l4.5 4.5" />
      <text className="label" x="84" y="24">
        R
      </text>
      <path className="al" d="M76 48V61M71.5 56.5l4.5 4.5l4.5-4.5" />
      <text className="label" x="84" y="61">
        D
      </text>
    </>
  )
}

function SwitchOff() {
  return (
    <>
      <circle className="a" cx="30" cy="40" r="16" />
      <text className="on big" x="30" y="44.5" textAnchor="middle">
        P
      </text>
      <path className="l" d="M54 40H68M63.5 35.5l4.5 4.5l-4.5 4.5" />
      <path className="rim" strokeWidth="4" d="M82 38V31a9 9 0 0 1 18 0v7" />
      <rect className="k" x="76" y="38" width="30" height="24" rx="7" />
      <circle className="p" cx="91" cy="47.5" r="3" />
      <rect className="p" x="89.8" y="48" width="2.4" height="7.5" rx="1.2" />
    </>
  )
}

function Regen() {
  return (
    <>
      {/* the accelerator, foot lifting off */}
      <path className="l" strokeWidth="3" d="M27 62V76" />
      <rect className="d" x="18" y="32" width="17" height="34" rx="5.5" transform="rotate(-16 26 49)" />
      <path className="al" d="M46 44V26M41.5 30.5l4.5-4.5l4.5 4.5" />
      <path className="al" d="M54 50H66M61.5 45.5l4.5 4.5l-4.5 4.5" />
      <rect className="p" x="72" y="36" width="38" height="28" rx="7" />
      <rect className="d" x="110" y="44" width="4" height="12" rx="1.5" />
      <rect className="a" x="76.5" y="40.5" width="8" height="19" rx="2.5" />
      <rect className="a" x="87" y="40.5" width="8" height="19" rx="2.5" />
      <rect className="as" x="97.5" y="40.5" width="8" height="19" rx="2.5" />
      <path className="a" d="M93 12l-7 10h5l-2 8l8-11h-5.5z" />
    </>
  )
}

function Touchscreen() {
  return (
    <>
      <rect className="b" x="-4" y="54" width="128" height="16" rx="8" />
      <rect className="k" x="22" y="8" width="76" height="52" rx="9" />
      <rect className="tile" x="29" y="15" width="29" height="17" rx="4.5" />
      <rect className="tile" x="62" y="15" width="29" height="17" rx="4.5" />
      <rect className="tile" x="29" y="36" width="29" height="17" rx="4.5" />
      <rect className="a" x="62" y="36" width="29" height="17" rx="4.5" />
      {/* climate, mirrors, regen strength, and the finger on the fourth tile */}
      <path className="pl" d="M39 23.5H48M43.5 19V28" opacity="0.7" />
      <rect className="p" x="71" y="19.5" width="11" height="8" rx="2.2" opacity="0.6" />
      <path className="pl" d="M38 48.5V45.5M43.5 48.5V43M49 48.5V40.5" opacity="0.7" />
      <circle className="on" cx="76.5" cy="44.5" r="4.2" />
      <circle className="ol" cx="76.5" cy="44.5" r="7.2" opacity="0.5" strokeWidth="1.4" />
    </>
  )
}

function Battery() {
  return (
    <>
      <rect className="p" x="10" y="20" width="92" height="40" rx="10" />
      <rect className="d" x="102" y="32" width="7" height="16" rx="3" />
      <rect className="a" x="15.5" y="25.5" width="64" height="29" rx="5.5" />
      <text className="on big" x="47.5" y="44.5" textAnchor="middle">
        80%
      </text>
      <path className="l" d="M79.5 12V68" strokeDasharray="2.6 3.4" />
    </>
  )
}

function Flap() {
  return (
    <>
      {/* the rear quarter panel above the wheel arch */}
      <path className="p" d="M-4 6H124V84H-4Z" />
      <circle className="k" cx="40" cy="82" r="30" />
      <circle className="d" cx="40" cy="82" r="13" />
      <rect className="k" x="78" y="24" width="26" height="24" rx="6" />
      <circle className="p" cx="86.5" cy="32.5" r="2.6" />
      <circle className="p" cx="95.5" cy="32.5" r="2.6" />
      <rect className="d" x="84" y="38" width="14" height="6.5" rx="3.2" />
      <path className="a" d="M79 22.5L71 11.5H97L105 22.5Z" />
      <path className="al" d="M114 62L105 52M105 60V52H113" />
      {/* unlock first: an open padlock */}
      <path className="rim" strokeWidth="3" d="M17 28V21a6 6 0 0 1 12 0v2" />
      <rect className="d" x="12" y="28" width="22" height="16" rx="5" />
    </>
  )
}

/** The front of the car with the bonnet up and the cable coiled in the frunk. */
function Frunk() {
  return (
    <>
      <rect className="d" x="0" y="71" width="120" height="2" rx="1" opacity="0.4" />
      {/* body, nose to the left, cut off behind the front door */}
      <path className="p" d="M8 62V45Q8 39 14 37L38 33L53 20Q57 16 63 16H124V62H80A17 17 0 0 0 46 62Z" />
      <path className="k" d="M44 33L56 22.5Q58.5 20.5 62 20.5H82V33Z" />
      <rect className="k" x="86" y="20.5" width="34" height="12.5" rx="1.5" />
      <circle className="k" cx="63" cy="61" r="11" />
      <circle className="d" cx="63" cy="61" r="4.6" />
      {/* the bonnet, swung open, and the well underneath with the coiled cable */}
      <path className="d" d="M52 24.5L14 5.5L10.5 12L47 31.5Z" />
      <rect className="k" x="14" y="38.5" width="30" height="13" rx="4" />
      <circle className="gl" cx="22.5" cy="45" r="3.4" />
      <path className="gl" d="M26 45H37" />
    </>
  )
}

const ART: Record<GuideArtKey, () => React.JSX.Element> = {
  'park-flap': ParkFlap,
  'card-reader': CardReader,
  'plug-in': PlugIn,
  'card-then-unplug': CardThenUnplug,
  'card-back': CardBack,
  'no-start-button': NoStartButton,
  stalk: Stalk,
  'switch-off': SwitchOff,
  regen: Regen,
  touchscreen: Touchscreen,
  battery: Battery,
  flap: Flap,
  frunk: Frunk,
}

/** The picture for one guide entry, in a 3:2 box of `width` px. */
export function GuideArt({ art, width = 96, className }: ArtProps & { art: GuideArtKey }) {
  const Picture = ART[art]
  return (
    <svg
      className={className}
      width={width}
      height={Math.round((width * 2) / 3)}
      viewBox="0 0 120 80"
      aria-hidden="true"
      focusable="false"
    >
      <Picture />
    </svg>
  )
}
