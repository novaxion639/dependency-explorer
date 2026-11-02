import { HttpStatus, retrying, type Wire } from '../net/retry'

const ATTEMPTS = 5
const TIMEOUT_MS = 60_000
const RETRIED = new Set([408, 429, 500, 502, 503, 504])
const REFUSED = new Set([401, 403])
const VALIDATE_PATH = '/api/v1/validate'

export class Refused extends Error {
  override name = 'Refused'

  constructor(
    readonly status: number,
    method: string,
    path: string,
  ) {
    super(path === VALIDATE_PATH ? `Datadog refused the keys (HTTP ${status})` : `Datadog refused ${method} ${path} (HTTP ${status})`)
  }
}

export type DatadogClient = ReturnType<typeof datadogClient>

export function datadogClient(opts: { fetch: typeof fetch; site: string; apiKey: string; appKey: string; wire?: Wire }) {
  const base = `https://api.${opts.site}`
  const headers = { 'DD-API-KEY': opts.apiKey, 'DD-APPLICATION-KEY': opts.appKey, Accept: 'application/json' }
  const request = async (path: string, url: string, init: RequestInit & { method: string }): Promise<unknown> => {
    const send = async (): Promise<unknown> => {
      const res = await opts.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) {
        throw new HttpStatus(res.status, res.headers)
      }
      return res.json()
    }
    try {
      return await retrying(opts.wire ?? {}, ATTEMPTS, (status) => RETRIED.has(status), send)
    } catch (e) {
      if (e instanceof HttpStatus && REFUSED.has(e.status)) {
        throw new Refused(e.status, init.method, path)
      }
      throw e
    }
  }
  return {
    site: opts.site,
    get(path: string, query: Record<string, string> = {}): Promise<unknown> {
      const search = new URLSearchParams(query).toString()
      return request(path, `${base}${path}${search ? `?${search}` : ''}`, { method: 'GET', headers })
    },
    post(path: '/api/v2/events/search', body: unknown): Promise<unknown> {
      return request(path, `${base}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    },
  }
}
