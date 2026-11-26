import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useT } from '../lib/i18n'
import type { CarType } from '../lib/types'
import { ChevronRightIcon, PlusIcon } from './icons'
import { NavIcon, type NavName } from './NavIcon'
import { Sheet } from './Sheet'

/** How long the pressed look is held at least, so a quick tap still shows the
 * full contraction before the spring back (the CSS press takes 80ms). */
const MIN_PRESS_MS = 90

/**
 * The pressed state, driven by pointer and key events instead of `:active`.
 * Touch browsers hold `:active` back until they are sure the finger is not
 * about to scroll, and Chrome then keeps it on for a while after the finger
 * lifts as its own tap feedback, so on a phone the plus reacted late on the
 * way down and hung at the pressed size on the way up; pointerdown fires on
 * the first touch and pointerup the moment it lifts. The keyboard (space or
 * enter on the button) goes through the same state.
 */
function usePressed() {
  const [pressed, setPressed] = useState(false)
  const downAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const down = useCallback(() => {
    window.clearTimeout(timer.current)
    downAt.current = performance.now()
    setPressed(true)
  }, [])
  const up = useCallback(() => {
    window.clearTimeout(timer.current)
    const left = MIN_PRESS_MS - (performance.now() - downAt.current)
    if (left > 0) timer.current = window.setTimeout(() => setPressed(false), left)
    else setPressed(false)
  }, [])
  const isPressKey = (e: KeyboardEvent<HTMLElement>) => e.key === ' ' || e.key === 'Enter'
  return {
    pressed,
    onPointerDown: down,
    onPointerUp: up,
    onPointerCancel: up,
    onPointerLeave: up,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (isPressKey(e) && !e.repeat) down()
    },
    onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
      if (isPressKey(e)) up()
    },
  }
}

/**
 * The one way to add anything: *New ride*, a green capsule floating beside the
 * tab bar on a phone and a button at the head of the list on a wide screen.
 * Either opens the same sheet (`NewRideSheet`), which asks the one question
 * that matters first: who drives. People who meant to book a shared car used
 * to ask for a seat instead, because the two ways in looked alike and sat
 * apart; one button and three plainly worded rows end that.
 */
export function NewRideFab({ onClick }: { onClick: () => void }) {
  const t = useT()
  const { pressed, ...press } = usePressed()
  return (
    <button type="button" className={pressed ? 'fab fab-pressed' : 'fab'} onClick={onClick} {...press}>
      <PlusIcon size={22} weight="bold" />
      {t.newRide.button}
    </button>
  )
}

/** The same button where nothing floats: at the head of a wide screen's list. */
export function NewRideButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <button type="button" className="btn btn-primary new-ride-btn" onClick={onClick}>
      <PlusIcon size={18} weight="bold" />
      {t.newRide.button}
    </button>
  )
}

/** What a new ride can be: you drive a shared car, you drive your own, or you need a seat. */
export type NewRideKind = CarType | 'ask'

interface SheetProps {
  /** Which rows to offer: a shared car needs a pool, asking needs a day you have no ride on. */
  kinds: NewRideKind[]
  onPick: (kind: NewRideKind) => void
  onClose: () => void
}

const MARK: Record<NewRideKind, [NavName, string]> = {
  corporate: ['key', 'tile-green'],
  own: ['car', 'tile-blue'],
  ask: ['hand', 'tile-orange'],
}

/** *New ride*: who drives? One row each, the answer in the row's own words. */
export function NewRideSheet({ kinds, onPick, onClose }: SheetProps) {
  const t = useT()
  const words: Record<NewRideKind, [string, string]> = {
    corporate: [t.newRide.shared, t.newRide.sharedHint],
    own: [t.newRide.own, t.newRide.ownHint],
    ask: [t.newRide.ask, t.newRide.askHint],
  }
  return (
    <Sheet title={t.newRide.title} id="new-ride-title" onClose={onClose} className="panel-short">
      <ul className="group choice-list">
        {kinds.map((k) => (
          <li key={k}>
            <button type="button" className="group-row choice" onClick={() => onPick(k)}>
              <span className={`tile ${MARK[k][1]}`} aria-hidden="true">
                <NavIcon name={MARK[k][0]} variant="filled" size={18} />
              </span>
              <span className="group-text">
                <strong>{words[k][0]}</strong>
                <small>{words[k][1]}</small>
              </span>
              <ChevronRightIcon size={16} className="group-chevron" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
