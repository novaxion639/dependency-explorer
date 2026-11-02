export const RETRY_AFTER_CAP_MS = 60_000
export const RETRY_AFTER_FLOOR_MS = 1000

const HTTP_DATE = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/

export function retryAfterMs(headers: Headers): number | null {
  const value = (headers.get('retry-after') ?? '').trim()
  let ms: number
  if (/^\d+$/.test(value)) {
    ms = Number(value) * 1000
  } else if (HTTP_DATE.test(value)) {
    ms = Date.parse(value) - Date.now()
  } else {
    return null
  }
  if (Number.isNaN(ms)) {
    return null
  }
  return Math.min(Math.max(ms, RETRY_AFTER_FLOOR_MS), RETRY_AFTER_CAP_MS)
}
