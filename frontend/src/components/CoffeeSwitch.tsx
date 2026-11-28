import { useId, useState } from 'react'
import { useT } from '../lib/i18n'

/** A flat mug: empty until `full`, then the coffee rises in it and it steams. */
export function CoffeeCup({ full, size = 40 }: { full: boolean; size?: number }) {
  const clip = useId()
  return (
    <svg className={`coffee-cup${full ? ' is-full' : ''}`} width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d="M10 18h20v9a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" />
        </clipPath>
      </defs>
      <g className="coffee-steam">
        <path d="M15 13c-2-2.4 2-3.8 0-6.6" />
        <path d="M20 13c-2-2.4 2-3.8 0-6.6" />
        <path d="M25 13c-2-2.4 2-3.8 0-6.6" />
      </g>
      <g clipPath={`url(#${clip})`}>
        <g className="coffee-liquid">
          <rect x="8" y="21" width="24" height="16" />
          <path className="coffee-crema" d="M8 21h24" />
        </g>
      </g>
      <path className="coffee-mug" d="M10 18h20v9a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" />
      <path className="coffee-mug" d="M30 21h2.2a4.3 4.3 0 0 1 0 8.6h-2.6" />
      <path className="coffee-mug" d="M9 39.5h22" />
    </svg>
  )
}

/** The driver's coffee hint in the ride form: a switch whose cup fills and steams once it is on. */
export function CoffeeSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const t = useT()
  // Only a tap pours: a form opened with the hint already on shows a full cup standing still.
  const [poured, setPoured] = useState(false)
  return (
    <label className={`switch-row coffee-row${on ? ' is-on' : ''}${on && poured ? ' is-poured' : ''}`}>
      <CoffeeCup full={on} />
      <span className="switch-row-text">
        <span className="switch-row-title">{t.form.coffee}</span>
        <span className="coffee-row-wink" aria-hidden={!on}>
          <span className="switch-row-desc">{t.form.coffeeOn}</span>
        </span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setPoured(e.target.checked)
          onChange(e.target.checked)
        }}
      />
    </label>
  )
}
