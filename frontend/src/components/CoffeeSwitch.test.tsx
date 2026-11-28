import { act, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '../test/render'
import { CoffeeSwitch } from './CoffeeSwitch'

const me = { id: 1, name: 'Ana Test', admin: false }

function Held({ start }: { start: boolean }) {
  const [on, setOn] = useState(start)
  return <CoffeeSwitch on={on} onChange={setOn} />
}

describe('CoffeeSwitch', () => {
  it('fills the cup and owns up to the hint once it is switched on', () => {
    const { host } = render(<Held start={false} />, { me })
    const row = host.querySelector('.coffee-row')!
    const box = host.querySelector('input')!
    expect(box.checked).toBe(false)
    expect(host.querySelector('.coffee-cup.is-full')).toBeNull()
    expect(host.querySelector('.coffee-row-wink')!.getAttribute('aria-hidden')).toBe('true')

    act(() => box.click())
    expect(box.checked).toBe(true)
    expect(host.querySelector('.coffee-cup.is-full')).not.toBeNull()
    expect(host.querySelector('.coffee-row-wink')!.getAttribute('aria-hidden')).toBe('false')
    expect(row.classList.contains('is-poured')).toBe(true)

    act(() => box.click())
    expect(host.querySelector('.coffee-cup.is-full')).toBeNull()
    expect(row.classList.contains('is-poured')).toBe(false)
  })

  it('stands still when the form opens with the hint already on', () => {
    const { host } = render(<Held start />, { me })
    expect(host.querySelector('.coffee-cup.is-full')).not.toBeNull()
    expect(host.querySelector('.coffee-row')!.classList.contains('is-poured')).toBe(false)
  })
})
