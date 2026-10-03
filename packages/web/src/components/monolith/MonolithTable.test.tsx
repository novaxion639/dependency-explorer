import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MonolithRow } from '../../diagram/layouts/monolith'
import { MonolithTable } from './MonolithTable'

const rows: MonolithRow[] = [
  { areaId: 'billing', name: 'Billing', files: 85, routes: 64, tables: 5 },
  { areaId: 'planning', name: 'Planning', files: 125, routes: 83, tables: 13 },
  { areaId: null, name: 'Not mapped yet', files: 396, routes: 246, tables: 1 },
]

describe('MonolithTable', () => {
  const html = renderToStaticMarkup(<MonolithTable rows={rows} onOpenArea={() => {}} />)
  it('ranks areas by files and keeps the unmapped code last', () => {
    expect(html.indexOf('Planning')).toBeLessThan(html.indexOf('Billing'))
    expect(html.indexOf('Billing')).toBeLessThan(html.indexOf('Not mapped yet'))
    expect(html).toMatch(/aria-sort="descending"><button[^>]*>Files</)
  })
  it('opens an area from its name, never from the unmapped row', () => {
    expect(html).toContain('>Planning</button>')
    expect(html).not.toContain('>Not mapped yet</button>')
    expect(html).toContain('aria-label="skello-app by product area"')
  })
})
