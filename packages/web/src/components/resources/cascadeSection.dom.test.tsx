// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { CascadeSection } from './CascadeSection'
import { WritePathsSection } from './WritePathsSection'

function mount(table: string, event: 'create' | 'update' | 'destroy' | null, calls: string[]) {
  const host = document.createElement('div')
  act(() => {
    createRoot(host).render(<CascadeSection table={table} event={event} onEvent={e => calls.push(`event:${e}`)} onOpenResource={id => calls.push(`open:${id}`)} />)
  })
  return host
}

describe('CascadeSection', () => {
  it('draws the shifts update cascade with weekly_options reached asynchronously', () => {
    const host = mount('pg:skello_production.shifts', null, [])
    expect(host.querySelector('section[aria-label="Also changes"]')).not.toBeNull()
    expect([...host.querySelectorAll('button')].map(b => b.textContent)).toContain('weekly_options')
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe('update')
  })
  it('switches the event', () => {
    const calls: string[] = []
    const host = mount('pg:skello_production.shifts', null, calls)
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'destroy')?.click())
    expect(calls).toEqual(['event:destroy'])
  })
  it('labels the event group', () => {
    const host = mount('pg:skello_production.shifts', null, [])
    expect(host.querySelector('[role="group"][aria-label="Event"] button[aria-pressed="true"]')?.textContent).toBe('update')
  })
  it('says so when the selected event reaches no table', () => {
    const host = mount('pg:skello_production.billing_infos', 'create', [])
    expect(host.textContent).toContain('No table changes on create.')
    expect(host.querySelector('ul')).toBeNull()
  })
  it('gives every hop an accessible grade glyph', () => {
    const host = mount('pg:skello_production.shifts', null, [])
    const glyphs = [...host.querySelectorAll('section[aria-label="Also changes"] [role="img"]')]
    expect(glyphs.length).toBeGreaterThan(0)
    expect(glyphs.every(g => (g.getAttribute('aria-label') ?? '') !== '')).toBe(true)
  })
  it('opens the reached table', () => {
    const calls: string[] = []
    const host = mount('pg:skello_production.shifts', null, calls)
    act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'weekly_options')?.click())
    expect(calls).toEqual(['open:pg:skello_production.weekly_options'])
  })
  it('renders nothing for a table that reaches no other table', () => {
    expect(mount('pg:skello_production.no_such_table', null, []).querySelector('section')).toBeNull()
  })
})

describe('WritePathsSection', () => {
  it('groups shift write paths by what they run, each with an accessible grade and source', () => {
    const host = document.createElement('div')
    act(() => {
      createRoot(host).render(<WritePathsSection table="pg:skello_production.shifts" onOpenFlow={() => {}} />)
    })
    expect(host.querySelector('section[aria-label="Write paths"]')).not.toBeNull()
    expect(host.textContent).toContain('Runs no listener')
    expect(host.textContent).toContain('written at ')
    const headings = [...host.querySelectorAll('section[aria-label="Write paths"] h3')].map(h => h.textContent)
    expect(headings.some(h => h?.startsWith('Runs no listener '))).toBe(true)
    expect(host.querySelector('section[aria-label="Write paths"] [role="img"]')?.getAttribute('aria-label')).not.toBeNull()
  })
  it('renders nothing for a table with no write site', () => {
    const host = document.createElement('div')
    act(() => {
      createRoot(host).render(<WritePathsSection table="pg:skello_production.no_such_table" onOpenFlow={() => {}} />)
    })
    expect(host.querySelector('section')).toBeNull()
  })
})
