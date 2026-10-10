// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { autoFlow } from '../../diagram/layouts/fixtures'
import { UnitDetail } from './UnitDetail'

const noop = () => {}

function mount(id: string): HTMLElement {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<UnitDetail flow={autoFlow} id={id} onOpenFlow={noop} onOpenResource={noop} onClose={noop} />)
  })
  return host
}

const texts = (host: HTMLElement, selector: string) => [...host.querySelectorAll(selector)].map(e => e.textContent)

describe('UnitDetail with a state machine', () => {
  it('explains a machine opened from its frame', () => {
    const host = mount('sm-auto')
    expect(texts(host, 'h2')).toEqual(['AutoAssign state machine'])
    expect(texts(host, 'dt')).toContain('Falls to the error handler')
    expect(texts(host, 'dd')).toContain('fetch data, filter users, per batch, aggregate, solve, assign shifts, finish job')
  })
  it('explains a choice opened from its node', () => {
    const host = mount('empty')
    expect(texts(host, 'h2')).toEqual(['empty?'])
    expect(texts(host, 'dd')).toContain('→ finish job')
  })
})
