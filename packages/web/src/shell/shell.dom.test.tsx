// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
import { parseUrl } from '../hooks/useUrlState'
import { AppShell } from './AppShell'
import { Rail } from './Rail'
import { renderWithNav } from '../test/renderWithNav'

const noop = () => {}
const renderShell = (qs: string, panel: string | null = null) =>
  renderWithNav(<AppShell url={parseUrl(qs)} onSearch={noop} onTogglePresent={noop} panel={panel}><p>canvas</p></AppShell>, qs)

describe('Rail', () => {
  it('groups modules by question without a landmark per group', () => {
    renderWithNav(<Rail />, '?page=monolith')

    const nav = screen.getByRole('navigation', { name: 'Modules' })
    expect(within(nav).getAllByRole('group').map(g => g.getAttribute('aria-label'))).toEqual(['Understand', 'Change', 'People'])
    expect(within(nav).queryAllByRole('region')).toHaveLength(0)
  })

  it('links each module and marks the current page', () => {
    renderWithNav(<Rail />, '?page=monolith')

    const monolith = screen.getByRole('link', { name: /^Monolith/ })
    expect(monolith.getAttribute('aria-current')).toBe('page')
    expect(monolith.getAttribute('href')).toBe('/?page=monolith')
    expect(screen.getByRole('link', { name: /^Ownership/ }).getAttribute('aria-current')).toBeNull()
  })
})

describe('Rail navigation', () => {
  it('reports a followed link so the mobile rail can close', async () => {
    const onFollow = vi.fn()
    renderWithNav(<Rail onFollow={onFollow} />, '?page=monolith')

    await userEvent.click(screen.getByRole('link', { name: /^Ownership/ }))

    expect(onFollow).toHaveBeenCalledOnce()
  })
})

describe('AppShell', () => {
  it('shows home without rail or breadcrumb', () => {
    renderShell('')

    expect(screen.queryByRole('navigation', { name: 'Modules' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(screen.getByText('canvas')).toBeTruthy()
  })

  it('frames inner pages with the rail, the breadcrumb and the panel', () => {
    renderShell('?page=microservices&s=svc-punch', 'edge detail')

    expect(screen.getByRole('navigation', { name: 'Modules' })).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('svc-punch')).toBeTruthy()
    expect(within(screen.getByRole('complementary', { name: 'Details' })).getByText('edge detail')).toBeTruthy()
  })

  it('links the title to home', () => {
    renderShell('?page=resources')

    expect(screen.getByRole('link', { name: 'Skello · Dependency Explorer' }).getAttribute('href')).toBe('/')
  })

  it('offers the rail behind a collapsed Menu button', () => {
    renderShell('?page=resources')

    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('hides the rail and panel in present mode', () => {
    renderShell('?page=microservices&s=svc-punch&present=1', 'edge detail')

    expect(screen.queryByRole('navigation', { name: 'Modules' })).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Exit present' })).toBeTruthy()
  })
})
