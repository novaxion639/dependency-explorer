// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ListenerSchema } from '@dependency-explorer/data'
import { ListenersSection } from './ListenersSection'

const at = { file: 'app/models/shift.rb', line: 196 }
const listener = ListenerSchema.parse({
  id: 'shifts.after_commit.update_paid_leaves', table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', method: 'update_paid_leaves',
  events: ['create', 'update', 'destroy'], phase: 'commit', condition: 'if: :user_id?', declaredAt: at, grade: 'code',
  effects: [{ kind: 'enqueues', target: 'UpdatePaidLeavesCounterJob', mode: 'async-job', at, grade: 'constant' }],
})

function mount(open: string | null, calls: string[]) {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<ListenersSection listeners={[listener]} filters={{ lev: null, lkind: null, lgrade: null }} open={open} onFilters={p => calls.push(JSON.stringify(p))} onToggle={id => calls.push(`toggle:${id ?? ''}`)} onOpenResource={() => {}} />)
  })
  return host
}
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))

describe('ListenersSection', () => {
  it('lists each listener with its hook, method, events and condition', () => {
    const host = mount(null, [])
    expect(host.querySelector('section[aria-label="Listeners"] h2')?.textContent).toBe('Listeners · 1 of 1')
    expect(button(host, 'update_paid_leaves')?.getAttribute('aria-expanded')).toBe('false')
    expect(host.textContent).toContain('if: :user_id?')
  })
  it('toggles a row and shows its effects when open', () => {
    const calls: string[] = []
    const closed = mount(null, calls)
    act(() => button(closed, 'update_paid_leaves')?.click())
    expect(calls).toEqual(['toggle:shifts.after_commit.update_paid_leaves'])
    expect(mount('shifts.after_commit.update_paid_leaves', []).textContent).toContain('enqueues UpdatePaidLeavesCounterJob · async')
  })
  it('reports filter changes', () => {
    const calls: string[] = []
    const host = mount(null, calls)
    const select = host.querySelector('select[aria-label="Kind"]')
    act(() => {
      if (select instanceof HTMLSelectElement) {
        select.value = 'cascade'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    expect(calls).toEqual(['{"lkind":"cascade"}'])
  })
})
