import { useEffect, useRef, useState } from 'react'

const RUN_MS = 650

/**
 * A whole number that counts its way to `value`: from 0 when it first shows,
 * from where it stood when the value changes. A reader hears the figure
 * itself; under reduced motion it simply stands there.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  const at = useRef(0)
  useEffect(() => {
    const start = at.current
    if (start === value) return
    const put = (n: number) => {
      at.current = n
      setShown(n)
    }
    let frame = 0
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = requestAnimationFrame(() => put(value))
      return () => cancelAnimationFrame(frame)
    }
    const began = performance.now()
    const step = (now: number) => {
      const part = Math.min(1, (now - began) / RUN_MS)
      put(Math.round(start + (value - start) * (1 - (1 - part) ** 3)))
      if (part < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">{shown}</span>
    </>
  )
}
