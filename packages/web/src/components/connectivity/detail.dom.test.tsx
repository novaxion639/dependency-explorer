// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { connectivityMap } from '@dependency-explorer/data'
import { EdgeDetail } from './EdgeDetail'
import { EndpointList } from './EndpointList'
import { ConnectionList } from './ConnectionList'

const noop = () => {}
const conn = connectivityMap.connections.find(c => c.usedEndpoints.length > 0)
const punch = connectivityMap.services.find(s => s.name === 'svc-punch')

describe('detail panel content', () => {
  it('describes a connection', () => {
    render(conn && <EdgeDetail connection={conn} map={connectivityMap} onSeeEndpoints={noop} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Connection' })
    expect(within(panel).getByRole('heading', { name: `${conn?.from} ${conn?.to}` })).toBeTruthy()
    expect(within(panel).getByText(conn?.protocol ?? '')).toBeTruthy()
  })

  it('lists a service endpoints inline', () => {
    render(<EndpointList serviceName="svc-punch" endpoints={punch?.endpoints ?? []} highlightId={null} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Endpoints' })
    expect(within(panel).getByRole('heading', { name: 'svc-punch' })).toBeTruthy()
    expect(within(panel).getAllByText(punch?.endpoints[0]?.path ?? '').length).toBeGreaterThan(0)
  })

  it('lists the connections behind an aggregated edge', () => {
    const conns = connectivityMap.connections.filter(c => c.to === 'skello-app' && c.protocol === 'cdc')
    render(<ConnectionList connections={conns} onOpen={noop} onClose={noop} />)

    const panel = screen.getByRole('article', { name: 'Connections' })
    expect(within(panel).getByRole('heading', { name: `${conns.length} connections` })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'svc-search → skello-app' })).toBeTruthy()
  })

  it('opens the service whose endpoints are listed', async () => {
    const onOpenService = vi.fn()
    render(<EndpointList serviceName="svc-punch" endpoints={punch?.endpoints ?? []} highlightId={null} onClose={noop} onOpenService={onOpenService} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open svc-punch' }))

    expect(onOpenService).toHaveBeenCalledOnce()
  })

  it.each([
    ['Connection', () => conn && <EdgeDetail connection={conn} map={connectivityMap} onSeeEndpoints={noop} onClose={noop} />],
    ['Endpoints', () => <EndpointList serviceName="svc-punch" endpoints={[]} highlightId={null} onClose={noop} />],
    ['Connections', () => <ConnectionList connections={[]} onOpen={noop} onClose={noop} />],
  ])('closes the %s panel from a named close button', (name, panel) => {
    render(panel())

    expect(within(screen.getByRole('article', { name })).getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
