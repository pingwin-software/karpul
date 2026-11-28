/**
 * Your rides: the title the all-time figures earn, the month and all-time
 * figures behind one switch, and what a period or an account with nothing in
 * it says instead of a row of zeros.
 */
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth'
import { messages } from '../lib/i18n'
import type { PersonStats, StatBucket } from '../lib/types'
import { render } from '../test/render'
import { MyRides } from './MyRides'

const t = () => messages().myRides
const me = { id: 1, name: 'Ana Test' }
const user: AuthUser = { id: 1, username: 'ana', phone: null, first_name: 'Ana', last_name: 'Test', display_name: 'Ana Test', is_admin: false, calendar_token: 'tok', created_at: '2026-01-01T00:00:00Z' }

const bucket = (over: Partial<StatBucket> = {}): StatBucket => ({ rides_driven: 0, rides_ridden: 0, people_carried: 0, km_shared: 0, car_km_avoided: 0, co2_kg: 0, fuel_l: 0, ...over })

async function open(stats: PersonStats) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  const view = render(<MyRides user={user} onNotice={() => {}} onClose={() => {}} />, { me })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  await act(async () => {})
  return view
}

/** The figures as a reader hears them, tile by tile. */
const figures = (host: HTMLElement) => Array.from(host.querySelectorAll('.mr-tile')).map((el) => `${el.querySelector('.sr-only')!.textContent} ${el.querySelector('.mr-tile-label')!.textContent}`)

describe('MyRides', () => {
  it('names the account and shows one period at a time', async () => {
    const { host } = await open({
      month: bucket({ rides_ridden: 1 }),
      all: bucket({ rides_driven: 1, rides_ridden: 1, people_carried: 3, km_shared: 90, car_km_avoided: 180, co2_kg: 30.6, fuel_l: 12.6 }),
      history: [],
    })
    expect(host.querySelector('.mr-rank')!.textContent).toBe(t().rank.both)
    expect(figures(host)).toEqual([`0 ${t().driven}`, `1 ${t().ridden}`, `0 ${t().carried}`, `0 ${t().km}`])
    expect(host.querySelectorAll('.mr-tile.is-zero')).toHaveLength(3)

    const allTime = Array.from(host.querySelectorAll('[role="radio"]')).find((b) => b.textContent === t().allTime) as HTMLElement
    act(() => allTime.click())
    expect(figures(host)).toEqual([`1 ${t().driven}`, `1 ${t().ridden}`, `3 ${t().carried}`, `90 ${t().km}`])
    expect(host.querySelector('.mr-impact-runs')!.textContent).toBe(t().impactRuns(2))
  })

  it('says so in words when there is nothing to count', async () => {
    const { host } = await open({ month: bucket(), all: bucket(), history: [] })
    expect(host.querySelector('.mr-rank')!.textContent).toBe(t().rank.parked)
    expect(host.querySelector('.mr-tile')).toBeNull()
    expect(host.querySelector('.mr-quiet')!.textContent).toBe(t().quietMonth)
    expect(host.querySelector('.mr-impact-none')!.textContent).toContain(t().impactNone)
  })
})
