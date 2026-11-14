// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MonolithRow } from '../../diagram/layouts/monolith'
import { renderInApp } from '../../test/renderInApp'
import { MonolithTable } from './MonolithTable'

const rows: MonolithRow[] = [
  { areaId: 'billing', name: 'Billing', files: 85, routes: 90, tables: 5 },
  { areaId: 'planning', name: 'Planning', files: 125, routes: 83, tables: 13 },
  { areaId: null, name: 'Not mapped yet', files: 396, routes: 246, tables: 1 },
]

const table = () => screen.getByRole('table', { name: 'skello-app by product area' })
const rowHeaders = () => within(table()).getAllByRole('rowheader').map(h => h.textContent)

describe('MonolithTable', () => {
  it('ranks areas by files and keeps the unmapped code last', () => {
    renderInApp(<MonolithTable rows={rows} />)

    expect(rowHeaders()).toEqual(['Planning', 'Billing', 'Not mapped yet'])
  })

  it('marks the files column as the sorted one', () => {
    renderInApp(<MonolithTable rows={rows} />)

    expect(within(table()).getByRole('columnheader', { name: 'Files' }).getAttribute('aria-sort')).toBe('descending')
  })

  it('re-ranks by a column when its header is pressed, the unmapped code still last', async () => {
    renderInApp(<MonolithTable rows={rows} />)

    await userEvent.click(within(table()).getByRole('button', { name: 'Routes' }))

    expect(rowHeaders()).toEqual(['Billing', 'Planning', 'Not mapped yet'])
    expect(within(table()).getByRole('columnheader', { name: 'Routes' }).getAttribute('aria-sort')).toBe('descending')
  })

  it('links an area to its spotlight on the monolith page', () => {
    renderInApp(<MonolithTable rows={rows} />, '?page=monolith')

    expect(within(table()).getByRole('link', { name: 'Planning' }).getAttribute('href')).toBe('/?page=monolith&area=planning')
  })

  it('leaves the unmapped row without a link', () => {
    renderInApp(<MonolithTable rows={rows} />)

    expect(within(table()).queryByRole('link', { name: 'Not mapped yet' })).toBeNull()
  })
})
