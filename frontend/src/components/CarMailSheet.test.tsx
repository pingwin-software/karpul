/**
 * The mail to the office: right after taking a shared car it cannot be
 * skipped until the mail is opened, and the driver's word that it went out
 * is what goes on record (`POST /api/rides/{id}/office-mail`).
 */
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../lib/i18n'
import { aRide, render } from '../test/render'
import { CarMailSheet } from './CarMailSheet'

const t = () => messages().carMail
const ride = aRide({ id: 7, car_type: 'corporate', car_name: 'Mazda 6e (BG-1)', approval: 'approved', series_id: 's1' })

let calls: { url: string; body: string | null }[]
beforeEach(() => {
  sessionStorage.clear()
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: (init?.body as string) ?? null })
      const answer = String(url).includes('/office-mail') ? { ...ride, office_mailed_at: '2026-11-18T09:02:00Z' } : []
      return new Response(JSON.stringify(answer), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

function sheet(props: { locked?: boolean; repeatUntil?: string | null } = {}) {
  const onSent = vi.fn()
  const onClose = vi.fn()
  const view = render(<CarMailSheet rides={[ride]} onSent={onSent} onError={vi.fn()} onClose={onClose} {...props} />, { me: { id: 1, name: 'Ana Anić' } })
  return { view, onSent, onClose }
}

describe('CarMailSheet', () => {
  it('cannot be closed right after taking the car until the mail is opened', async () => {
    const { view, onClose } = sheet({ locked: true })
    await flush()
    expect(view.button(messages().common.close)).toBeNull()
    act(() => view.button(t().open)!.click())
    await flush()
    // Opened: now it asks whether it went out, and *Not yet* lets go.
    expect(view.button(t().sent)).not.toBeNull()
    act(() => view.button(t().notYet)!.click())
    expect(onClose).toHaveBeenCalled()
  })

  it('records a mail written by hand, for the coming weeks of a series too', async () => {
    const { view, onSent } = sheet({ locked: true, repeatUntil: '2026-12-31' })
    await flush()
    await act(async () => view.button(t().alreadySent)!.click())
    await flush()
    const marked = calls.find((c) => c.url.endsWith('/api/rides/7/office-mail'))
    expect(marked?.body).toBe(JSON.stringify({ series: true }))
    expect(onSent).toHaveBeenCalledWith([expect.objectContaining({ id: 7, office_mailed_at: '2026-11-18T09:02:00Z' })])
  })

  it('names the approved car when it is opened later', async () => {
    const { view } = sheet()
    await flush()
    expect(view.text()).toContain('Mazda 6e (BG-1)')
    expect(view.button(messages().common.close)).not.toBeNull()
  })
})
