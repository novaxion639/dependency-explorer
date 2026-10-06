export interface UnitRef { flow: string; id: string; service: string; path?: string }

export function checkUnitPaths(
  units: UnitRef[],
  pinOf: (service: string) => string | undefined,
  cloned: (service: string) => boolean,
  existsAt: (service: string, sha: string, file: string) => boolean,
): { missing: string[]; skipped: number } {
  const missing: string[] = []
  let skipped = 0
  for (const u of units) {
    if (!u.path) {
      continue
    }
    const pin = pinOf(u.service)
    if (!pin || !cloned(u.service)) {
      skipped += 1
      continue
    }
    if (!existsAt(u.service, pin, u.path)) {
      missing.push(`${u.flow} ${u.id} ${u.service}@${pin.slice(0, 7)} ${u.path}`)
    }
  }
  return { missing, skipped }
}
