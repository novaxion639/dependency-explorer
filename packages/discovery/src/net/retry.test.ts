import { afterEach, expect, test, vi } from 'vitest'
import { Exhausted, HttpStatus, backoffMs, retrying, type Wire } from './retry'

afterEach(() => {
  vi.useRealTimers()
})

const status = (code: number, headers: Record<string, string> = {}) => new HttpStatus(code, new Headers(headers))

function scripted(failures: Error[]) {
  const queue = [...failures]
  const sleeps: number[] = []
  const wire: Wire = { signal: new AbortController().signal, sleep: (ms) => Promise.resolve(void sleeps.push(ms)) }
  let sent = 0
  const send = () => {
    sent++
    const failure = queue.shift()
    return failure ? Promise.reject(failure) : Promise.resolve('ok')
  }
  return { wire, send, sleeps, sent: () => sent }
}

const on429 = (s: number) => s === 429

test('the growing wait is 2, 3, 5 then 9 seconds', () => {
  expect([0, 1, 2, 3].map(backoffMs)).toEqual([2000, 3000, 5000, 9000])
})

test('a call that answers is sent once and never waits', async () => {
  const { wire, send, sleeps, sent } = scripted([])
  expect(await retrying(wire, 5, on429, send)).toBe('ok')
  expect([sent(), sleeps]).toEqual([1, []])
})

test('a retried status is sent again after the growing wait', async () => {
  const { wire, send, sleeps, sent } = scripted([status(429), status(429)])
  expect(await retrying(wire, 5, on429, send)).toBe('ok')
  expect([sent(), sleeps]).toEqual([3, [2000, 3000]])
})

test('a Retry-After wins over the growing wait, in seconds or as a date', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-12T08:30:00Z') })
  const { wire, send, sleeps } = scripted([
    status(429, { 'Retry-After': '7' }),
    status(429, { 'Retry-After': 'Thu, 12 Mar 2026 08:30:12 GMT' }),
    status(429, { 'Retry-After': 'plus tard' }),
  ])
  expect(await retrying(wire, 5, on429, send)).toBe('ok')
  expect(sleeps).toEqual([7000, 12_000, 5000])
})

test('the last attempt throws Exhausted with its status and waits no more', async () => {
  const last = status(429)
  const { wire, send, sleeps, sent } = scripted([status(429), status(429), last])
  const e = await retrying(wire, 3, on429, send).catch((x: unknown) => x)
  expect(e).toBeInstanceOf(Exhausted)
  expect(e instanceof Exhausted && e.last).toBe(last)
  expect(e instanceof Exhausted && e.message).toBe('HTTP 429 on every attempt')
  expect([sent(), sleeps]).toEqual([3, [2000, 3000]])
})

test.each<[string, Error]>([
  ['a status not retried', status(403)],
  ['a failure with no status', new SyntaxError('bad json')],
])('%s passes as it is, sent once', async (_name, failure) => {
  const { wire, send, sleeps, sent } = scripted([failure])
  expect(await retrying(wire, 5, on429, send).catch((x: unknown) => x)).toBe(failure)
  expect([sent(), sleeps]).toEqual([1, []])
})

test('without a sleep of its own, the wire waits on the job\'s signal, so a stop ends the wait', async () => {
  const job = new AbortController()
  const wire: Wire = { signal: job.signal }
  const pending = retrying(wire, 5, on429, () => Promise.reject(status(429, { 'Retry-After': '60' })))
  job.abort()
  expect(await pending.catch((x: unknown) => x)).toMatchObject({ name: 'AbortError' })
})
