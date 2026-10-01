import * as fs from 'node:fs'

const SUBJECT_FIELDS = ['flow', 'rule', 'subject', 'service', 'edge'] as const
const EDGE_DRIFT_SECTIONS = ['candidates', 'unknownTargets', 'stale', 'unverifiable']

export function stableDetail(detail: string): string {
  return detail.replace(/\b[0-9a-f]{12,}\b/g, '#').replace(/\b(L?)\d+\b/g, '$1N')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function findingKeys(report: Record<string, unknown>): string[] {
  const keys = new Set<string>()
  for (const [section, value] of Object.entries(report)) {
    if (EDGE_DRIFT_SECTIONS.includes(section) && Array.isArray(value)) {
      for (const e of value.filter(isRecord)) {
        keys.add(`${section}||${String(e.from)}→${String(e.to ?? e.normalizedTarget)}|`)
      }
      continue
    }
    if (!isRecord(value) || !Array.isArray(value.findings)) {
      continue
    }
    for (const f of value.findings) {
      if (!isRecord(f)) {
        continue
      }
      const subject = SUBJECT_FIELDS.map(k => f[k]).find(v => typeof v === 'string') ?? ''
      keys.add([section, String(f.kind ?? ''), String(subject), stableDetail(String(f.detail ?? ''))].join('|'))
    }
  }
  return [...keys].sort()
}

export function diffBaseline(current: string[], baseline: string[]) {
  const base = new Set(baseline)
  const now = new Set(current)
  return {
    added: current.filter(k => !base.has(k)),
    resolved: baseline.filter(k => !now.has(k)),
    carried: current.filter(k => base.has(k)).length,
  }
}

export function readBaseline(file: string): string[] {
  if (!fs.existsSync(file)) {
    return []
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
  return isRecord(parsed) && Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === 'string') : []
}

export function writeBaseline(file: string, keys: string[]): void {
  fs.writeFileSync(file, JSON.stringify({ keys }, null, 2) + '\n')
}
