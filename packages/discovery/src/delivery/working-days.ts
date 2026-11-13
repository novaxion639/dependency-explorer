const DAY_MS = 86_400_000
const toMs = (day: string): number => Date.parse(`${day}T00:00:00Z`)
const toDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export function easterOf(year: number): string {
  const [a, b, c] = [year % 19, Math.floor(year / 100), year % 100]
  const g = Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3)
  const h = (19 * a + b - Math.floor(b / 4) - g + 15) % 30
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7
  const n = h + l - 7 * Math.floor((a + 11 * h + 22 * l) / 451) + 114
  return toDay(Date.UTC(year, Math.floor(n / 31) - 1, (n % 31) + 1))
}

const FIXED_HOLIDAYS = new Set(['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'])
const EASTER_MONDAY_ASCENSION_WHIT_MONDAY = [1, 39, 50]

function isFrenchHoliday(day: string): boolean {
  if (FIXED_HOLIDAYS.has(day.slice(5))) {
    return true
  }
  const easter = toMs(easterOf(Number(day.slice(0, 4))))
  return EASTER_MONDAY_ASCENSION_WHIT_MONDAY.some((n) => toDay(easter + n * DAY_MS) === day)
}

export function isWorkingDay(day: string): boolean {
  const weekday = new Date(toMs(day)).getUTCDay()
  return weekday !== 0 && weekday !== 6 && !isFrenchHoliday(day)
}

export function workingDaysBetween(from: string, to: string): number {
  const [lo, hi, sign] = from <= to ? [from, to, 1] : [to, from, -1]
  let n = 0
  for (let ms = toMs(lo) + DAY_MS; ms <= toMs(hi); ms += DAY_MS) {
    if (isWorkingDay(toDay(ms))) {
      n++
    }
  }
  return sign * n
}

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })

export function parisDay(iso: string): string {
  return PARIS_DAY.format(new Date(iso))
}
