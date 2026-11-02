// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DatadogOverlay } from '@dependency-explorer/data'
import { overlayOf } from '../components/health/overlayFixture'
import { useOverlay } from './useOverlay'

const roots: Root[] = []

const probe = async (fetchImpl: typeof fetch, copies = 1) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const seen: Array<DatadogOverlay | null> = []
  function Probe() {
    seen.push(useOverlay(fetchImpl))
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  await act(async () => root.render(Array.from({ length: copies }, (_, i) => createElement(Probe, { key: i }))))
  return seen.at(-1)
}

const respond = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }))

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(r => r.unmount()))
  vi.restoreAllMocks()
})

describe('useOverlay', () => {
  it('returns the overlay', async () => {
    const fetchImpl = respond(overlayOf())
    expect(await probe(fetchImpl)).toEqual(overlayOf())
    expect(fetchImpl).toHaveBeenCalledWith('/overlay/datadog.json')
  })
  it('fetches once per page load however many pages read it', async () => {
    const fetchImpl = respond(overlayOf())
    await probe(fetchImpl, 3)
    expect(await probe(fetchImpl)).toEqual(overlayOf())
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('returns null on 404', async () => {
    expect(await probe(respond({}, 404))).toBeNull()
  })
  it('returns null on a network error', async () => {
    expect(await probe(vi.fn<typeof fetch>(async () => { throw new TypeError('Failed to fetch') }))).toBeNull()
  })
  it('ignores an overlay that fails the schema', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await probe(respond({ snapshotDate: 3 }))).toBeNull()
    expect(error).toHaveBeenCalledTimes(1)
  })
})
