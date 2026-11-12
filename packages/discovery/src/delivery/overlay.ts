import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DeliveryOverlay } from '@dependency-explorer/schema'
import { defaultGit, errorText, type GitRunner } from '../pinned'
import { lastRelease, promotionsLookSquashed, waitingChanges, type Change } from './changes'
import { fetchTrunk, trunkOf } from './trunk'
import { parisDay, workingDaysBetween } from './working-days'

type DeliveryService = DeliveryOverlay['services'][string]

export interface DeliveryReport {
  overlay: DeliveryOverlay
  skipped: Array<{ repo: string; reason: string }>
  unpromoted: string[]
  stale: Array<{ repo: string; fetchedAt: string }>
}

const DAY_MS = 86_400_000
const LATE_WORKING_DAYS = 3
const STALE_FETCH_DAYS = 3
const STEP_ORDER = ['sandbox', 'staging'] as const

function fetchedAtOf(dir: string): string | null {
  const file = path.join(dir, '.git', 'FETCH_HEAD')
  return fs.existsSync(file) ? fs.statSync(file).mtime.toISOString() : null
}

const oldestOf = (changes: Change[]): Change | undefined =>
  changes.reduce<Change | undefined>((oldest, c) => (oldest === undefined || Date.parse(c.mergedAt) < Date.parse(oldest.mergedAt) ? c : oldest), undefined)

function serviceOf(dir: string, now: Date, fetch: boolean, git: GitRunner): { entry: DeliveryService; squashed: boolean } | null {
  if (fetch) {
    fetchTrunk(dir, git)
  }
  const trunk = trunkOf(dir, now, git)
  if (trunk === null) {
    return null
  }
  const today = parisDay(now.toISOString())
  const changes = waitingChanges(dir, trunk, now, git)
  const steps = STEP_ORDER.flatMap((branch) => {
    const waiting = changes.filter((c) => c.branch === branch)
    const oldest = oldestOf(waiting)
    if (oldest === undefined) {
      return []
    }
    const { sha, title, mergedAt } = oldest
    return [{ branch, count: waiting.length, oldest: { sha, title, mergedAt, workingDays: workingDaysBetween(parisDay(mergedAt), today) } }]
  })
  const entry = {
    prod: trunk.prod,
    fetchedAt: fetchedAtOf(dir),
    steps,
    late: steps.some((step) => step.oldest.workingDays >= LATE_WORKING_DAYS),
    lastRelease: lastRelease(dir, trunk, git),
  }
  return { entry, squashed: promotionsLookSquashed(dir, trunk, now, git) }
}

export function buildDeliveryOverlay(repos: Array<{ service: string; dir: string }>, now: Date, fetch: boolean, git: GitRunner = defaultGit): DeliveryReport {
  const report: DeliveryReport = { overlay: { generatedAt: now.toISOString(), services: {} }, skipped: [], unpromoted: [], stale: [] }
  for (const { service, dir } of repos) {
    try {
      const read = serviceOf(dir, now, fetch, git)
      if (read !== null) {
        report.overlay.services[service] = read.entry
      }
      if (read?.squashed) {
        report.unpromoted.push(service)
      }
    } catch (e) {
      report.skipped.push({ repo: service, reason: errorText(e) })
      continue
    }
    const fetchedAt = fetchedAtOf(dir)
    if (fetchedAt !== null && now.getTime() - Date.parse(fetchedAt) > STALE_FETCH_DAYS * DAY_MS) {
      report.stale.push({ repo: service, fetchedAt })
    }
  }
  return report
}

const oldestDays = (service: DeliveryService): number => Math.max(...service.steps.map((step) => step.oldest.workingDays))

export function deliverySection(delivery: DeliveryReport | null): string | null {
  if (delivery === null) {
    return null
  }
  const late = Object.entries(delivery.overlay.services)
    .filter(([, service]) => service.late)
    .sort(([, a], [, b]) => oldestDays(b) - oldestDays(a))
    .map(([name, service]) => `- ${name}: ${service.steps.map((s) => `${s.count} on ${s.branch}, oldest ${s.oldest.workingDays} working days (${s.oldest.title})`).join('; ')}`)
  const lines = [
    ...late,
    ...delivery.skipped.map(({ repo, reason }) => `- ${repo} skipped: ${reason}`),
    ...delivery.unpromoted.map((repo) => `- ${repo}: prod moved since its oldest waiting merge, yet holds none of its sandbox or staging merges of 90 days: are promotions squashed?`),
    ...delivery.stale.map(({ repo, fetchedAt }) => `- ${repo} fetched ${fetchedAt.slice(0, 10)}: run with --pinned to refresh`),
  ]
  return ['\n## 🚚 Delivery (advisory, not in the baseline)\n', ...(lines.length ? lines : ['_none_'])].join('\n')
}
