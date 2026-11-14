// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { DatadogOverlaySchema, JiraOverlaySchema, type JiraOverlay } from '@dependency-explorer/data'
import { overlayOf } from '../components/health/overlayFixture'
import { useOverlay } from './useOverlay'

const jiraOverlay: JiraOverlay = {
  snapshotDate: '2026-11-02',
  host: 'skello.atlassian.net',
  areas: {},
  unmapped: { open: 0, breached: 0, jql: '' },
  boards: {},
}

const serve = (respond: (url: string) => Response | Promise<Response>) => {
  const fetchStub = vi.fn<typeof fetch>(async input => respond(String(input)))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const byName = (url: string) => (url.endsWith('/jira.json') ? json(jiraOverlay) : json(overlayOf()))

const datadog = () => renderHook(() => useOverlay('datadog', DatadogOverlaySchema))
const settle = () => act(async () => {})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useOverlay', () => {
  it('returns the overlay', async () => {
    serve(() => json(overlayOf()))

    const { result } = datadog()

    await waitFor(() => expect(result.current).toEqual(overlayOf()))
  })

  it('reads it from the overlay folder', async () => {
    const fetchStub = serve(() => json(overlayOf()))

    datadog()
    await settle()

    expect(fetchStub).toHaveBeenCalledWith('/overlay/datadog.json')
  })

  it('fetches once per page load however many pages read it', async () => {
    const fetchStub = serve(() => json(overlayOf()))
    datadog()
    datadog()
    await settle()

    const { result } = datadog()

    expect(result.current).toEqual(overlayOf())
    expect(fetchStub).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 404', () => json({}, 404)],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('returns null on %s', async (_name, respond) => {
    const fetchStub = serve(respond)

    const { result } = datadog()
    await settle()

    expect(fetchStub).toHaveBeenCalledOnce()
    expect(result.current).toBeNull()
  })

  it('ignores an overlay that fails the schema, and says why', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    serve(() => json({ snapshotDate: 3 }))

    const { result } = datadog()
    await settle()

    expect(result.current).toBeNull()
    expect(error.mock.calls.map(([message]) => message)).toEqual(['datadog overlay ignored: it fails its schema'])
  })

  it('logs a broken overlay once however many pages mount it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    serve(() => json({ snapshotDate: 3 }))
    datadog()
    datadog()
    await settle()

    datadog()
    await settle()

    expect(error).toHaveBeenCalledOnce()
  })

  it('parses an overlay already loaded once per mount', async () => {
    serve(() => json(overlayOf()))
    datadog()
    await settle()
    const parse = vi.spyOn(DatadogOverlaySchema, 'safeParse')

    const { result } = datadog()

    expect(result.current).toEqual(overlayOf())
    expect(parse).toHaveBeenCalledOnce()
  })

  it('follows a change of overlay name after mount', async () => {
    serve(byName)
    const { result, rerender } = renderHook(({ name }: { name: 'datadog' | 'jira' }) => (name === 'datadog' ? useOverlay(name, DatadogOverlaySchema) : useOverlay(name, JiraOverlaySchema)), { initialProps: { name: 'datadog' } })
    await settle()

    rerender({ name: 'jira' })

    await waitFor(() => expect(result.current).toEqual(jiraOverlay))
  })

  it('loads the Datadog overlay when jira.json is absent', async () => {
    serve(url => (url.endsWith('/datadog.json') ? json(overlayOf()) : json({}, 404)))

    const { result } = renderHook(() => ({ datadog: useOverlay('datadog', DatadogOverlaySchema), jira: useOverlay('jira', JiraOverlaySchema) }))

    await waitFor(() => expect(result.current).toEqual({ datadog: overlayOf(), jira: null }))
  })

  it('caches per name', async () => {
    const fetchStub = serve(byName)
    const both = () => renderHook(() => [useOverlay('datadog', DatadogOverlaySchema), useOverlay('jira', JiraOverlaySchema)])

    both()
    both()
    await settle()

    expect(fetchStub.mock.calls.map(([url]) => url)).toEqual(['/overlay/datadog.json', '/overlay/jira.json'])
  })
})
