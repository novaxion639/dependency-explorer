// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listenerMetrics, listenerSurface, resourceSurface } from '@dependency-explorer/data'
import { parseUrl, type UrlState } from '../../hooks/useUrlState'
import { renderInApp } from '../../test/renderInApp'
import { ResourcesIndex } from './ResourcesIndex'

const COUNTS = /^(\d+) listeners?( · \d+ also changes?)( · \d+ bypassing writes?)$/
const pgTables = resourceSurface.resources.filter(r => r.kind === 'table' && r.id.startsWith('pg:'))

const renderIndex = (qs = '?page=resources') => {
  const patch = vi.fn<(p: Partial<UrlState>) => void>()
  renderInApp(<ResourcesIndex url={parseUrl(qs)} patch={patch} />, qs)
  return patch
}

const counts = () => screen.queryAllByText(/^\d+ listeners? · /).map(el => el.textContent ?? '')

describe('ResourcesIndex cards', () => {
  it('shows listener, also-changes and bypassing counts on every pg table card', () => {
    renderIndex()

    expect(counts()).toHaveLength(pgTables.length)
  })

  it('has a pg table with no listener in the dataset', () => {
    const metrics = listenerMetrics(listenerSurface)

    expect(pgTables.some(r => !metrics.has(r.id))).toBe(true)
  })

  it('shows zeros for a table with no listener and no write site', () => {
    renderIndex()

    expect(counts()).toContain('0 listeners · 0 also changes · 0 bypassing writes')
  })

  it('pluralises each count', () => {
    renderIndex()

    expect(counts().filter(t => !COUNTS.test(t))).toEqual([])
  })

  it('keeps a single listener singular', () => {
    renderIndex()

    expect(counts().some(t => t.startsWith('1 listener ·'))).toBe(true)
  })
})

describe('ResourcesIndex filters', () => {
  it('reads its filters from the URL, so Back restores them', () => {
    renderIndex('?page=resources&rkind=queue')

    expect(screen.getByRole('combobox', { name: 'Kind' })).toBe(screen.getByDisplayValue('queue'))
  })

  it('shows no pg table cards under the queue filter', () => {
    renderIndex('?page=resources&rkind=queue')

    expect(counts()).toHaveLength(0)
  })

  it.each([['Kind'], ['Owner'], ['Sort']])('names the %s select from its label', name => {
    renderIndex()

    expect(screen.getByRole('combobox', { name })).toBeTruthy()
  })

  it('writes a changed kind to the URL', async () => {
    const patch = renderIndex()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'queue')

    expect(patch).toHaveBeenCalledWith({ rkind: 'queue' })
  })

  it('writes a checked filter to the URL', async () => {
    const patch = renderIndex()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Cycles only' }))

    expect(patch).toHaveBeenCalledWith({ cycles: true })
  })
})

describe('ResourcesIndex cards as links', () => {
  it('links each card to its resource page', () => {
    renderIndex()

    expect(screen.getByText('shifts').closest('a')?.getAttribute('href')).toBe(`/?page=resources&resource=${encodeURIComponent('pg:skello_production.shifts')}`)
  })
})
