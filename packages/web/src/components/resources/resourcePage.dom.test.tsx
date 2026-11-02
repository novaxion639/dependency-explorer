// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { allResourceRelations, connectivityMap, resourceImpact, resourceSurface } from '@dependency-explorer/data'
import { overlayOf } from '../health/overlayFixture'
import { ResourcePage } from './ResourcePage'

const noop = () => {}
const props = { onOpenResource: noop, onOpenFile: noop, onOpenFlow: noop, onSelectService: noop, onBlast: noop, listeners: { event: null, listener: null, lev: null, lkind: null, lgrade: null }, onListeners: noop }
const source = resourceSurface.resources.map(r => resourceImpact(r.id, connectivityMap, resourceSurface.resources, allResourceRelations)).find(i => i?.dlq)
const sourceId = source?.resource.id ?? ''
const dlqId = source?.dlq ?? ''
const roots: Root[] = []

const render = async (id: string, body: unknown, status = 200) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  const host = document.createElement('div')
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<ResourcePage id={id} {...props} />))
  return host.textContent ?? ''
}

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.unstubAllGlobals()
})

describe('ResourcePage with the Datadog overlay', () => {
  const withDepth = overlayOf({ queues: { [dlqId]: { depthNow: 12, depthMax14d: 40 } } })

  it('finds a queue with a dead-letter queue in the registry', () => {
    expect(dlqId).not.toBe('')
  })
  it('shows the depth of a dead-letter queue in its header', async () => {
    expect(await render(dlqId, withDepth)).toContain('Depth: 12 now, 40 max over 14 days')
  })
  it('ends the source queue dead-letter line with the waiting count', async () => {
    expect(await render(sourceId, withDepth)).toContain(`Dead letters go to ${dlqId} (12 waiting)`)
  })
  it('shows neither without an overlay', async () => {
    const dlqPage = await render(dlqId, {}, 404)
    const sourcePage = await render(sourceId, {}, 404)
    expect(dlqPage).not.toContain('Depth:')
    expect(sourcePage).toContain(`Dead letters go to ${dlqId}`)
    expect(sourcePage).not.toContain('waiting')
  })
})
