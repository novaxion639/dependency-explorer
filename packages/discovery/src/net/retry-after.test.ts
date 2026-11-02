import { afterEach, expect, test, vi } from 'vitest'
import { RETRY_AFTER_CAP_MS, RETRY_AFTER_FLOOR_MS, retryAfterMs } from './retry-after'

afterEach(() => {
  vi.useRealTimers()
})

const asked = (value?: string) => retryAfterMs(new Headers(value === undefined ? {} : { 'Retry-After': value }))

test('a Retry-After in seconds asks for that wait, a second at least', () => {
  expect([asked('7'), asked(' 0 ')]).toEqual([7000, 1000])
  expect(RETRY_AFTER_FLOOR_MS).toBe(1000)
})

test('a Retry-After as an HTTP date asks for the time left until it, a second once it passed', () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-12T08:30:00Z') })
  expect(asked('Thu, 12 Mar 2026 08:30:30 GMT')).toBe(30_000)
  expect(asked('Thu, 12 Mar 2026 08:29:00 GMT')).toBe(1000)
})

test('a wait past the cap waits the cap', () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-12T08:30:00Z') })
  expect([asked('3600'), asked('Thu, 12 Mar 2026 10:00:00 GMT')]).toEqual([RETRY_AFTER_CAP_MS, RETRY_AFTER_CAP_MS])
  expect(RETRY_AFTER_CAP_MS).toBe(60_000)
})

test.each([undefined, '', 'soon', '1.5', '-3', '2026-03-12T08:30:30Z', 'Mon, 99 Foo 2026 00:00:00 GMT'])('%j asks for nothing', (value) => {
  expect(asked(value)).toBeNull()
})
