import { Bound } from '../net/at-most'
import { HttpStatus, retrying, type Wire } from '../net/retry'

const ATTEMPTS = 5
const TIMEOUT_MS = 60_000
const IN_FLIGHT = 4
const REFUSED = new Set([401, 403])
const MYSELF_PATH = '/rest/api/3/myself'

export class Refused extends Error {
  override name = 'Refused'

  constructor(
    readonly status: number,
    path: string,
  ) {
    super(
      status === 401 && path === MYSELF_PATH
        ? 'Jira refused the credentials (HTTP 401): use a classic API token without scopes'
        : `Jira refused GET ${path} (HTTP ${status})`,
    )
  }
}

export type JiraClient = ReturnType<typeof jiraClient>

export function jiraClient(opts: { fetch: typeof fetch; host: string; email: string; token: string; wire?: Wire }) {
  const headers = { Authorization: `Basic ${Buffer.from(`${opts.email}:${opts.token}`).toString('base64')}`, Accept: 'application/json' }
  const bound = new Bound(IN_FLIGHT)
  return {
    host: opts.host,
    async get(path: string, query: Record<string, string> = {}): Promise<unknown> {
      const search = new URLSearchParams(query).toString()
      const url = `https://${opts.host}${path}${search ? `?${search}` : ''}`
      const send = (): Promise<unknown> =>
        bound.run(async () => {
          const res = await opts.fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
          if (!res.ok) {
            throw new HttpStatus(res.status, res.headers)
          }
          return res.json()
        })
      try {
        return await retrying(opts.wire ?? {}, ATTEMPTS, (status) => status === 429, send)
      } catch (e) {
        if (e instanceof HttpStatus && REFUSED.has(e.status)) {
          throw new Refused(e.status, path)
        }
        throw e
      }
    },
  }
}
