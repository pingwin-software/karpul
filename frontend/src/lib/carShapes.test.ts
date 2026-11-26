import { describe, expect, it } from 'vitest'
import { CAR_BOX, CAR_MODEL_KEYS, carShape } from './carShapes'

describe('the cars the board can draw', () => {
  it.each(CAR_MODEL_KEYS)('%s is a whole drawing inside the box', (key) => {
    const s = carShape(key)
    for (const d of [s.body, s.glass, s.head, s.tail, ...s.doors, ...s.pillars]) {
      expect(d.startsWith('M')).toBe(true)
      expect(d).not.toMatch(/NaN|Infinity|undefined/)
      // Every coordinate of every path sits inside the box.
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...nums)).toBeLessThanOrEqual(CAR_BOX.width)
    }
    expect(s.wheels).toHaveLength(2)
    // The wheels stand on the ground line, the front one ahead of the rear.
    expect(s.wheels[0].cx).toBeLessThan(s.wheels[1].cx)
    expect(s.wheels[0].cy + s.wheels[0].r).toBeCloseTo(s.wheels[1].cy + s.wheels[1].r, 5)
  })

  it('draws a longer car longer: all to one scale', () => {
    expect(carShape('mazda6e').halfLength).toBeGreaterThan(carShape('fiat500').halfLength)
  })
})
