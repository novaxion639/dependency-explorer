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

const unverified = ListenerSchema.parse({
  id: 'shifts.after_commit.touch_week', table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', method: 'touch_week',
  events: ['update'], phase: 'commit', declaredAt: at, grade: 'code',
  effects: [{ kind: 'enqueues', target: 'TouchWeekJob', mode: 'async-job', at, grade: 'text' }],
})
const NO_FILTERS = { lev: null, lkind: null, lgrade: null }

function mount(open: string | null, calls: string[], filters: { lev: string | null; lkind: string | null; lgrade: string | null } = NO_FILTERS, listeners = [listener]) {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<ListenersSection listeners={listeners} filters={filters} open={open} onFilters={p => calls.push(JSON.stringify(p))} onToggle={id => calls.push(`toggle:${id ?? ''}`)} onOpenResource={() => {}} />)
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
  it('grades every row, verified or unverified, with an accessible name', () => {
    const host = mount(null, [], NO_FILTERS, [listener, unverified])
    const rows = [...host.querySelectorAll('li')]
    const glyph = (row: Element | undefined, label: string) => row?.querySelector(`[role="img"][aria-label="${label}"]`)?.textContent
    expect(glyph(rows[0], 'verified')).toBe('✓')
    expect(glyph(rows[1], 'unverified, receiver named after a model')).toBe('~')
  })
  it('names the grade glyph of an opened effect', () => {
    const host = mount('shifts.after_commit.update_paid_leaves', [])
    expect(host.querySelectorAll('[role="img"][aria-label="verified"]').length).toBe(2)
  })
  it('labels the event filter Listener event', () => {
    const host = mount(null, [])
    expect(host.querySelector('select[aria-label="Listener event"]')).toHaveProperty('value', 'all')
    expect(host.querySelector('select[aria-label="Event"]')).toBeNull()
  })
  it('treats a filter value outside its options as no filter', () => {
    const host = mount(null, [], { lev: null, lkind: 'bogus', lgrade: null })
    expect(host.querySelector('h2')?.textContent).toBe('Listeners · 1 of 1')
    expect(host.querySelector('select[aria-label="Kind"]')).toHaveProperty('value', 'all')
  })
  it('says so when the filters hide every listener', () => {
    const host = mount(null, [], { lev: null, lkind: 'cascade', lgrade: null })
    expect(host.textContent).toContain('No listener matches these filters.')
    expect(host.querySelector('ol')).toBeNull()
  })
  it('prefixes the source links with declared and defined', () => {
    const host = mount(null, [], NO_FILTERS, [ListenerSchema.parse({ ...listener, definedAt: { file: 'app/models/concerns/x.rb', line: 3 } })])
    expect(host.textContent).toContain('declared app/models/shift.rb:196')
    expect(host.textContent).toContain('defined app/models/concerns/x.rb:3')
  })
})
