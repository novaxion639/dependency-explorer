import { HttpStatus, retrying, type Wire } from '../net/retry'

const ATTEMPTS = 5
const RETRIED = new Set([408, 429, 500, 502, 503, 504])

export type DatadogClient = ReturnType<typeof datadogClient>

export function datadogClient(opts: { fetch: typeof fetch; site: string; apiKey: string; appKey: string; wire?: Wire }) {
  const base = `https://api.${opts.site}`
  const headers = { 'DD-API-KEY': opts.apiKey, 'DD-APPLICATION-KEY': opts.appKey, Accept: 'application/json' }
  const request = (url: string, init: RequestInit): Promise<unknown> =>
    retrying(opts.wire ?? {}, ATTEMPTS, (status) => RETRIED.has(status), async (): Promise<unknown> => {
      const res = await opts.fetch(url, init)
      if (!res.ok) {
        throw new HttpStatus(res.status, res.headers)
      }
      return res.json()
    })
  return {
    site: opts.site,
    get(path: string, query: Record<string, string> = {}): Promise<unknown> {
      const search = new URLSearchParams(query).toString()
      return request(`${base}${path}${search ? `?${search}` : ''}`, { method: 'GET', headers })
    },
    post(path: string, body: unknown): Promise<unknown> {
      return request(`${base}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    },
  }
}
