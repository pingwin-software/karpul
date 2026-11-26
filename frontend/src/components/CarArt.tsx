import { useId } from 'react'
import {
  siAudi,
  siBmw,
  siChevrolet,
  siCitroen,
  siDacia,
  siDsautomobiles,
  siFiat,
  siFord,
  siHonda,
  siHyundai,
  siJeep,
  siKia,
  siLada,
  siMazda,
  siMg,
  siMini,
  siMitsubishi,
  siNissan,
  siOpel,
  siPeugeot,
  siPolestar,
  siPorsche,
  siRenault,
  siSeat,
  siSkoda,
  siSmart,
  siSubaru,
  siSuzuki,
  siTesla,
  siToyota,
  siVolkswagen,
  siVolvo,
  type SimpleIcon,
} from 'simple-icons'
import { carBrand, carModel, carPaint, carPowertrain, powertrainLabel, type CarBrandKey, type CarModelKey, type Powertrain } from '../lib/carModels'
import { CAR_BOX, carShape } from '../lib/carShapes'
import { BoltIcon, CarIcon, DropIcon, LeafIcon, PumpIcon } from './icons'

/**
 * A car's picture: a flat side view, facing left, drawn from the model's
 * numbers in `lib/carShapes.ts` (`lib/carModels.ts` decides which model a car
 * name is, and what colour it speaks of). One paint, a darker band along the
 * sill, slate glass, plain wheels, no gradients and no shading, so a car sits
 * in a row the way an icon does, in light and in dark alike. A car the board
 * cannot draw but whose make it recognises gets the make's logo instead
 * (`BrandLogo`, marks from the `simple-icons` package, in `currentColor`).
 * Anything else keeps the generic car icon.
 */

/** The drawings share one box: long and low, like the cars. */
const ART_RATIO = CAR_BOX.height / CAR_BOX.width

function mix(hex: string, other: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = parse(hex)
  const b = parse(other)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

interface ArtProps {
  model: CarModelKey
  /** Rendered width in px; the height follows the box. */
  width: number
  /** The paint, as `#rrggbb`; the model's own when left out. */
  paint?: string | null
  className?: string
}

export function CarArt({ model, width, paint, className }: ArtProps) {
  const id = useId()
  const clip = (name: string) => `url(#${CSS.escape(id + name)})`
  const s = carShape(model)
  const body = paint ?? s.paint
  const light = luminance(body) > 0.72
  const dark = luminance(body) < 0.22
  // A light car's details are a shade darker, a dark car's a shade lighter.
  const band = mix(body, '#000000', light ? 0.12 : 0.2)
  const line = mix(body, '#000000', light ? 0.17 : 0.28)
  const lamp = light ? mix(body, '#000000', 0.2) : mix(body, '#ffffff', 0.8)
  return (
    <svg
      width={width}
      height={Math.round(width * ART_RATIO)}
      viewBox={`0 0 ${CAR_BOX.width} ${CAR_BOX.height}`}
      className={className ? `car-art ${className}` : 'car-art'}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={id + 'body'}>
          <path d={s.body} />
        </clipPath>
        <clipPath id={id + 'glass'}>
          <path d={s.glass} />
        </clipPath>
      </defs>
      <ellipse cx={CAR_BOX.width / 2} cy={s.wheels[0].cy + s.wheels[0].r + 1} rx={s.halfLength * 0.94} ry={3.6} fill="#000" opacity={0.1} />
      {s.wheels.map((w) => (
        <circle key={w.cx} cx={w.cx} cy={w.cy} r={w.arch - 0.6} fill="#1c1c1e" />
      ))}
      <path d={s.body} fill={body} />
      <g clipPath={clip('body')}>
        <rect x={0} y={s.bandY} width={CAR_BOX.width} height={CAR_BOX.height - s.bandY} fill={s.cladding ? '#3a3a3c' : band} />
        {s.cladding && s.wheels.map((w) => <circle key={w.cx} cx={w.cx} cy={w.cy} r={w.arch + 3.4} fill="#3a3a3c" />)}
        <path d={s.head} fill={lamp} />
        <path d={s.tail} fill="#ff453a" />
      </g>
      {/* A hairline of light round the body, so a dark car still has an edge on a dark ground. */}
      <path d={s.body} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={1} />
      <path d={s.glass} fill={dark ? '#5a6672' : '#2d3742'} />
      <g clipPath={clip('glass')} fill="none" stroke={body} strokeWidth={4.4}>
        {s.pillars.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="none" stroke={line} strokeWidth={1.1} strokeLinecap="round">
        {s.doors.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {s.wheels.map((w) => (
        <g key={w.cx}>
          <circle cx={w.cx} cy={w.cy} r={w.r} fill="#1c1c1e" />
          <circle cx={w.cx} cy={w.cy} r={w.r * 0.6} fill="#d1d1d6" />
          <circle cx={w.cx} cy={w.cy} r={w.r * 0.2} fill="#8e8e93" />
        </g>
      ))}
    </svg>
  )
}

const LOGOS: Record<CarBrandKey, SimpleIcon> = {
  audi: siAudi,
  bmw: siBmw,
  volkswagen: siVolkswagen,
  toyota: siToyota,
  honda: siHonda,
  ford: siFord,
  skoda: siSkoda,
  renault: siRenault,
  peugeot: siPeugeot,
  citroen: siCitroen,
  fiat: siFiat,
  opel: siOpel,
  hyundai: siHyundai,
  kia: siKia,
  mazda: siMazda,
  nissan: siNissan,
  volvo: siVolvo,
  tesla: siTesla,
  porsche: siPorsche,
  subaru: siSubaru,
  suzuki: siSuzuki,
  mitsubishi: siMitsubishi,
  jeep: siJeep,
  chevrolet: siChevrolet,
  mini: siMini,
  dacia: siDacia,
  seat: siSeat,
  smart: siSmart,
  polestar: siPolestar,
  mg: siMg,
  lada: siLada,
  dsautomobiles: siDsautomobiles,
}

/** A make's logo, filled with `currentColor`, in a square of `size` px. */
export function BrandLogo({ brand, size = 22, className }: { brand: CarBrandKey; size?: number; className?: string }) {
  const icon = LOGOS[brand]
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  )
}

interface GlyphProps {
  carName: string
  /** Line-icon size; a model illustration is drawn about twice as wide. */
  size?: number
  className?: string
}

/**
 * The model illustration when there is one, else the make's logo when the
 * name gives one away, else the generic car icon.
 */
export function CarGlyph({ carName, size = 22, className }: GlyphProps) {
  const model = carModel(carName)
  if (model) return <CarArt model={model.key} paint={carPaint(carName)} width={Math.round(size * 2.8)} className={className} />
  const brand = carBrand(carName)
  if (brand) return <BrandLogo brand={brand.key} size={size} className={className} />
  return <CarIcon size={size} className={className} />
}

/** The glyph for what a car runs on: bolt, leaf, drop or pump. */
export function PowertrainIcon({ kind, size = 12 }: { kind: Powertrain; size?: number }) {
  const sw = 2.25
  if (kind === 'electric') return <BoltIcon size={size} strokeWidth={sw} />
  if (kind === 'hybrid') return <LeafIcon size={size} strokeWidth={sw} />
  if (kind === 'diesel') return <DropIcon size={size} strokeWidth={sw} />
  return <PumpIcon size={size} strokeWidth={sw} />
}

/**
 * A small mark beside the car's name saying what it runs on, nothing when
 * the name does not say. It lives in the text line, never over the picture,
 * so it can stay small (`.pt-mark`, 12px) without hiding the car. Electric
 * and hybrid are green, the fuel-burners muted. Pass a `carName` and it
 * decides for itself, or a `kind`.
 */
export function PowertrainMark({ carName, kind, className }: { carName?: string; kind?: Powertrain | null; className?: string }) {
  const pt = kind ?? (carName !== undefined ? carPowertrain(carName) : null)
  if (!pt) return null
  const label = powertrainLabel(pt)
  return (
    <span className={['pt-mark', `pt-mark-${pt}`, className].filter(Boolean).join(' ')} role="img" aria-label={label} title={label}>
      <PowertrainIcon kind={pt} />
    </span>
  )
}
