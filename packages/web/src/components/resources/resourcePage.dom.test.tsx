// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { screen } from '@testing-library/react'
import { allResourceRelations, connectivityMap, resourceImpact, resourceSurface } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { overlayOf } from '../health/overlayFixture'
import { ResourcePage } from './ResourcePage'

const noop = () => {}
const props = { onOpenResource: noop, onOpenFlow: noop, onBlast: noop, listeners: { event: null, listener: null, lev: null, lkind: null, lgrade: null }, onListeners: noop }
const source = resourceSurface.resources.map(r => resourceImpact(r.id, connectivityMap, resourceSurface.resources, allResourceRelations)).find(i => i?.dlq)
const sourceId = source?.resource.id ?? ''
const dlqId = source?.dlq ?? ''

const render = async (id: string, body: unknown, status = 200) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status })))
  await act(async () => {
    renderInApp(<ResourcePage id={id} {...props} />)
  })
}

const deadLetterLine = () => screen.getByText('Dead letters go to', { exact: false }).textContent

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ResourcePage with the Datadog overlay', () => {
  const withDepth = overlayOf({ queues: { [dlqId]: { depthNow: 12, depthMax14d: 40 } } })

  it('finds a queue with a dead-letter queue in the registry', () => {
    expect(dlqId).not.toBe('')
  })

  it('shows the depth of a dead-letter queue in its header', async () => {
    await render(dlqId, withDepth)

    expect(screen.getByText('Depth: 12 now, 40 max over 14 days', { exact: false })).toBeTruthy()
  })

  it('ends the source queue dead-letter line with the waiting count', async () => {
    await render(sourceId, withDepth)

    expect(deadLetterLine()).toBe(`Dead letters go to ${dlqId} (12 waiting)`)
  })

  it('shows no depth on a dead-letter queue without an overlay', async () => {
    await render(dlqId, {}, 404)

    expect(screen.queryByText('Depth:', { exact: false })).toBeNull()
  })

  it('shows no waiting count on the source queue without an overlay', async () => {
    await render(sourceId, {}, 404)

    expect(deadLetterLine()).toBe(`Dead letters go to ${dlqId}`)
  })
})
