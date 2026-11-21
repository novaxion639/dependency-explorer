// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fixtureMap } from '../../test/areaFixtures'
import { renderInApp } from '../../test/renderInApp'
import { EdgeDetail } from './EdgeDetail'
import { EndpointList } from './EndpointList'
import { ConnectionList } from './ConnectionList'

const noop = () => {}
const [conn] = fixtureMap.connections
const endpoints = fixtureMap.services.find(s => s.name === 'svc-punch')?.endpoints ?? []

describe('detail panel content', () => {
  it('describes a connection', () => {
    renderInApp(conn && <EdgeDetail connection={conn} map={fixtureMap} onSeeEndpoints={noop} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Connection' })
    expect(within(panel).getByRole('heading', { name: 'skello-app svc-punch' })).toBeTruthy()
    expect(within(panel).getByText('rest')).toBeTruthy()
  })

  it('lists a service endpoints inline', () => {
    renderInApp(<EndpointList serviceName="svc-punch" endpoints={endpoints} highlightId={null} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Endpoints' })
    expect(within(panel).getByRole('heading', { name: 'svc-punch' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'POST /v1/punches ✓' })).toBeTruthy()
  })

  it('opens the first endpoint by default', () => {
    renderInApp(<EndpointList serviceName="svc-punch" endpoints={endpoints} highlightId={null} onClose={noop} />)

    const [open] = within(screen.getByRole('article', { name: 'Endpoints' })).getAllByRole('button', { expanded: true })
    expect(open?.textContent).toContain('/v1/punches')
  })

  it('keeps one endpoint open at a time', async () => {
    renderInApp(<EndpointList serviceName="svc-punch" endpoints={endpoints} highlightId={null} onClose={noop} />)
    const panel = screen.getByRole('article', { name: 'Endpoints' })

    await userEvent.click(within(panel).getAllByRole('button', { expanded: false })[0] ?? panel)

    expect(within(panel).getAllByRole('button', { expanded: true })).toHaveLength(1)
  })

  it('leaves a collapsed endpoint body out of the page', () => {
    renderInApp(<EndpointList serviceName="svc-punch" endpoints={endpoints} highlightId={null} onClose={noop} />)

    expect(within(screen.getByRole('article', { name: 'Endpoints' })).getAllByText('Description')).toHaveLength(1)
  })

  it('lists the connections behind an aggregated edge', () => {
    const conns = fixtureMap.connections.filter(c => c.to === 'skello-app' && c.protocol === 'cdc')
    renderInApp(<ConnectionList connections={conns} onOpen={noop} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Connections' })
    expect(within(panel).getByRole('heading', { name: '2 connections' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'svc-search → skello-app' })).toBeTruthy()
  })

  it('opens the service whose endpoints are listed', async () => {
    const onOpenService = vi.fn()
    renderInApp(<EndpointList serviceName="svc-punch" endpoints={endpoints} highlightId={null} onClose={noop} onOpenService={onOpenService} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open svc-punch' }))

    expect(onOpenService).toHaveBeenCalledOnce()
  })

  it.each([
    ['Connection', () => conn && <EdgeDetail connection={conn} map={fixtureMap} onSeeEndpoints={noop} onClose={noop} />],
    ['Endpoints', () => <EndpointList serviceName="svc-punch" endpoints={[]} highlightId={null} onClose={noop} />],
    ['Connections', () => <ConnectionList connections={[]} onOpen={noop} onClose={noop} />],
  ])('closes the %s panel from a named close button', (name, panel) => {
    renderInApp(panel())

    expect(within(screen.getByRole('article', { name })).getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
