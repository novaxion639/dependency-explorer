import { setTimeout as wait } from 'node:timers/promises'
import { retryAfterMs } from './retry-after'

export type Wire = { sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; signal?: AbortSignal }

export class HttpStatus extends Error {
  override name = 'HttpStatus'

  constructor(
    readonly status: number,
    readonly headers: Headers,
  ) {
    super(`HTTP ${status}`)
  }
}

const sleep = (ms: number, signal?: AbortSignal) => wait(ms, undefined, { signal })

export const backoffMs = (attempt: number) => (2 ** attempt + 1) * 1000

export class Exhausted extends Error {
  override name = 'Exhausted'

  constructor(readonly last: HttpStatus) {
    super(`HTTP ${last.status} on every attempt`)
  }
}

export async function retrying<T>(
  wire: Wire,
  attempts: number,
  retried: (status: number) => boolean,
  send: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send()
    } catch (e) {
      if (!(e instanceof HttpStatus) || !retried(e.status)) {
        throw e
      }
      if (attempt >= attempts - 1) {
        throw new Exhausted(e)
      }
      await (wire.sleep ?? sleep)(retryAfterMs(e.headers) ?? backoffMs(attempt), wire.signal)
    }
  }
}
