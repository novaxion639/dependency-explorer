import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap } from '@dependency-explorer/data'
import { EdgeDetail } from './EdgeDetail'
import { EndpointList } from './EndpointList'
import { ConnectionList } from './ConnectionList'

const noop = () => {}

describe('detail panel content', () => {
  it('describes a connection without floating over the canvas', () => {
    const conn = connectivityMap.connections.find(c => c.usedEndpoints.length > 0)
    if (!conn) {
      throw new Error('no connection with used endpoints')
    }
    const html = renderToStaticMarkup(<EdgeDetail connection={conn} map={connectivityMap} onSeeEndpoints={noop} onClose={noop} />)
    expect(html).toContain(conn.from)
    expect(html).toContain(conn.to)
    expect(html).toContain(conn.protocol)
  })
  it('lists a service endpoints inline', () => {
    const svc = connectivityMap.services.find(s => s.name === 'svc-punch')
    if (!svc) {
      throw new Error('svc-punch missing')
    }
    const html = renderToStaticMarkup(<EndpointList serviceName={svc.name} endpoints={svc.endpoints} highlightId={null} onClose={noop} />)
    expect(html).toContain('svc-punch')
    expect(html).toContain(svc.endpoints[0]?.path ?? '')
  })
  it('lists the connections behind an aggregated edge', () => {
    const conns = connectivityMap.connections.filter(c => c.to === 'skello-app' && c.protocol === 'cdc')
    const html = renderToStaticMarkup(<ConnectionList connections={conns} onOpen={noop} onClose={noop} />)
    expect(html).toContain('aria-label="Connections"')
    expect(html).toContain(`${conns.length} connections`)
    expect(html).toContain('svc-search → skello-app')
  })
  it('opens the service whose endpoints are listed', () => {
    const svc = connectivityMap.services.find(s => s.name === 'svc-punch')
    const html = renderToStaticMarkup(<EndpointList serviceName="svc-punch" endpoints={svc?.endpoints ?? []} highlightId={null} onClose={noop} onOpenService={noop} />)
    expect(html).toContain('Open svc-punch →')
  })
})
