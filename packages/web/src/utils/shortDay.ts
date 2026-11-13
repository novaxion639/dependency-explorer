const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })

export function shortDay(iso: string): string {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? iso : dayMonth.format(ms)
}
