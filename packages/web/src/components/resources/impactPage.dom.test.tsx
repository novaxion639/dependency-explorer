// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ImpactPage } from './ImpactPage'

describe('ImpactPage filter', () => {
  it('keeps only hard failures through sync edges under the sync filter', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<ImpactPage origin="svc-requests" onSelect={() => {}} onOpenFlow={() => {}} onPick={() => {}} />))
    const sync = [...host.querySelectorAll('button')].find(b => b.textContent === 'Hard failures (sync)')
    await act(async () => sync?.click())
    expect(sync?.getAttribute('aria-pressed')).toBe('true')
    expect(host.innerHTML).not.toContain('>degrades<')
    expect(host.innerHTML).not.toContain('>starves<')
    expect(host.innerHTML).toContain('>fails<')
    root.unmount()
  })
})
