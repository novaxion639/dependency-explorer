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
      const subject = SUBJECT_FIELDS.map(k => f[k]).find(v => typeof v === 'string' && v !== '') ?? ''
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

function readField(file: string, field: 'keys' | 'repos'): string[] {
  if (!fs.existsSync(file)) {
    return []
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const value = isRecord(parsed) ? parsed[field] : undefined
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string') : []
}

export function readBaseline(file: string): string[] {
  return readField(file, 'keys')
}

export function readBaselineRepos(file: string): string[] {
  return readField(file, 'repos')
}

export function writeBaseline(file: string, keys: string[], repos: string[]): void {
  fs.writeFileSync(file, JSON.stringify({ repos: [...repos].sort(), keys }, null, 2) + '\n')
}

export function unscannedRepos(baselineRepos: string[], scanned: string[]): string[] {
  const now = new Set(scanned)
  return baselineRepos.filter(repo => !now.has(repo))
}
