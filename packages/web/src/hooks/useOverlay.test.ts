// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DatadogOverlaySchema, JiraOverlaySchema, type DatadogOverlay, type JiraOverlay } from '@dependency-explorer/data'
import { overlayOf } from '../components/health/overlayFixture'
import { useOverlay } from './useOverlay'

const roots: Root[] = []

const jiraOverlay: JiraOverlay = {
  snapshotDate: '2026-11-02',
  host: 'skello.atlassian.net',
  areas: {},
  unmapped: { open: 0, breached: 0, jql: '' },
  boards: {},
}

const probe = async (fetchImpl: typeof fetch, copies = 1) => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const seen: Array<DatadogOverlay | null> = []
  function Probe() {
    seen.push(useOverlay('datadog', DatadogOverlaySchema, fetchImpl))
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
    expect(error.mock.calls[0]?.[0]).toBe('datadog overlay ignored: it fails its schema')
  })
  it('logs a broken overlay once however many pages mount it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = respond({ snapshotDate: 3 })
    await probe(fetchImpl, 3)
    expect(await probe(fetchImpl)).toBeNull()
    expect(error).toHaveBeenCalledTimes(1)
  })
  it('parses an overlay already loaded once per mount', async () => {
    const fetchImpl = respond(overlayOf())
    await probe(fetchImpl)
    const parse = vi.spyOn(DatadogOverlaySchema, 'safeParse')
    expect(await probe(fetchImpl)).toEqual(overlayOf())
    expect(parse).toHaveBeenCalledTimes(1)
  })
  it('loads the Datadog overlay when jira.json is absent', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => new Response(String(input).endsWith('/datadog.json') ? JSON.stringify(overlayOf()) : '{}', { status: String(input).endsWith('/datadog.json') ? 200 : 404 }))
    const seen: Array<{ datadog: DatadogOverlay | null; jira: JiraOverlay | null }> = []
    function Both() {
      seen.push({ datadog: useOverlay('datadog', DatadogOverlaySchema, fetchImpl), jira: useOverlay('jira', JiraOverlaySchema, fetchImpl) })
      return null
    }
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const root = createRoot(document.createElement('div'))
    roots.push(root)
    await act(async () => root.render(createElement(Both)))
    expect(seen.at(-1)).toEqual({ datadog: overlayOf(), jira: null })
  })
  it('caches per name', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => new Response(JSON.stringify(String(input).endsWith('/jira.json') ? jiraOverlay : overlayOf())))
    function Both() {
      useOverlay('datadog', DatadogOverlaySchema, fetchImpl)
      useOverlay('jira', JiraOverlaySchema, fetchImpl)
      return null
    }
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const root = createRoot(document.createElement('div'))
    roots.push(root)
    await act(async () => root.render(createElement('div', null, createElement(Both), createElement(Both))))
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(['/overlay/datadog.json', '/overlay/jira.json'])
  })
})
