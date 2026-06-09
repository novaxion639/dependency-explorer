/**
 * Discovery — scans local Skello repo checkouts and reconciles them with the
 * dependency map (ADR-0004, ADR-0007).
 *
 * Usage (from the workspace root):
 *   pnpm discover                 # classified drift report (markdown)
 *   pnpm discover:json            # same, as JSON
 *   pnpm discover:apply           # also write packages/data/src/generated/discovered.json
 *
 * What it does:
 *   - Forward pass (code → map): SDK deps of TS repos + Rails monolith client
 *     classes become evidence. Existing connections get verified; new ones are
 *     reported as candidates for human adoption — never auto-added.
 *   - Reverse pass (map → code): every connection in the dataset is checked
 *     for evidence; the report distinguishes "stale" from "unverifiable".
 *   - Ownership: CODEOWNERS team slugs → teamId via teams.githubTeams mapping.
 *
 * SDK presence is evidence of a dependency, not proof of runtime calls (SDKs
 * are sometimes imported for types only) — which is why verified facts carry
 * provenance instead of silently becoming truth.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '@dependency-explorer/data'
import type { DiscoveredOverlay } from '@dependency-explorer/schema'
import { IGNORED_SDKS, sdkToServiceName } from './mapping'
import { extractTsRepo, extractRepoOwnership, type TsRepoFacts } from './extractors/typescript'
import { extractRailsMonolith } from './extractors/rails'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_BASE = path.resolve(__dirname, '../../../../')
const OVERLAY_PATH = path.resolve(__dirname, '../../data/src/generated/discovered.json')

const JSON_MODE = process.argv.includes('--json')
const APPLY_MODE = process.argv.includes('--apply')

// ── Dataset lookups ───────────────────────────────────────────────────────────

const serviceNames = new Set(connectivityMap.services.map(s => s.name))
const connectionKeys = new Set(connectivityMap.connections.map(c => `${c.from}→${c.to}`))
const slugToTeamId = new Map<string, string>()
for (const team of connectivityMap.teams ?? []) {
  for (const slug of team.githubTeams ?? []) slugToTeamId.set(slug, team.id)
}

// ── Result shapes ─────────────────────────────────────────────────────────────

interface Verified { from: string; to: string; evidence: string }
interface Candidate { from: string; to: string; evidence: string; transport: string }
interface UnknownTarget { from: string; evidence: string; normalizedTarget: string }
interface Stale { from: string; to: string; sdkPackage: string }
interface Unverifiable { from: string; to: string; reason: string }

interface Report {
  scannedRepos: string[]
  verified: Verified[]
  candidates: Candidate[]
  unknownTargets: UnknownTarget[]
  stale: Stale[]
  unverifiable: Unverifiable[]
  ignoredSdks: Record<string, string[]> // pkg → repos using it
  reposWithoutServiceDefinition: string[]
  railsUnmapped: string[]
  unmappedGithubTeams: string[]
  serviceFacts: DiscoveredOverlay['services']
}

function findRepos(): string[] {
  try {
    return fs.readdirSync(REPO_BASE, { withFileTypes: true })
      .filter(e => e.isDirectory()
        && (e.name.startsWith('svc-') || ['skello-app', 'skello-app-front', 'superadmin'].includes(e.name)))
      .map(e => e.name)
      .sort()
  } catch {
    return []
  }
}

function pickTeamId(githubTeams: Record<string, number>): string | undefined {
  const mapped = Object.entries(githubTeams)
    .filter(([slug]) => slugToTeamId.has(slug))
    .sort((a, b) => b[1] - a[1])
  return mapped.length ? slugToTeamId.get(mapped[0]![0]) : undefined
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function run(): Report {
  const repos = findRepos()
  const report: Report = {
    scannedRepos: repos,
    verified: [],
    candidates: [],
    unknownTargets: [],
    stale: [],
    unverifiable: [],
    ignoredSdks: {},
    reposWithoutServiceDefinition: [],
    railsUnmapped: [],
    unmappedGithubTeams: [],
    serviceFacts: {},
  }

  const verifiedKeys = new Set<string>()
  const allSlugs = new Set<string>()
  const tsFactsByRepo = new Map<string, TsRepoFacts>()

  // Forward pass — TypeScript repos
  for (const repo of repos) {
    const facts = extractTsRepo(REPO_BASE, repo)
    const githubTeams = facts?.githubTeams ?? extractRepoOwnership(REPO_BASE, repo)
    Object.keys(githubTeams).forEach(s => allSlugs.add(s))

    if (!serviceNames.has(repo)) {
      report.reposWithoutServiceDefinition.push(repo)
    } else {
      report.serviceFacts[repo] = {
        repoUrl: facts?.repoUrl ?? `https://github.com/skelloapp/${repo}`,
        teamId: pickTeamId(githubTeams),
        githubTeams: Object.keys(githubTeams).sort(),
      }
    }

    if (!facts) continue
    tsFactsByRepo.set(repo, facts)
    if (!serviceNames.has(repo)) continue // SDK deps of unmapped repos are reported via their section

    for (const pkg of facts.sdkPackages) {
      if (pkg in IGNORED_SDKS) {
        ;(report.ignoredSdks[pkg] ??= []).push(repo)
        continue
      }
      const target = sdkToServiceName(pkg)
      if (!target || !serviceNames.has(target)) {
        report.unknownTargets.push({ from: repo, evidence: pkg, normalizedTarget: target ?? '(ignored)' })
        continue
      }
      if (target === repo) continue
      const key = `${repo}→${target}`
      if (connectionKeys.has(key)) {
        report.verified.push({ from: repo, to: target, evidence: `package.json: ${pkg}` })
        verifiedKeys.add(key)
      } else {
        report.candidates.push({ from: repo, to: target, evidence: pkg, transport: 'rest (SDK client)' })
      }
    }
  }

  // Forward pass — Rails monolith outbound clients
  const rails = extractRailsMonolith(REPO_BASE)
  if (rails) {
    report.railsUnmapped = rails.unmapped
    for (const edge of rails.edges) {
      if (!serviceNames.has(edge.to)) {
        report.unknownTargets.push({ from: 'skello-app', evidence: edge.evidence.join(', '), normalizedTarget: edge.to })
        continue
      }
      const key = `skello-app→${edge.to}`
      if (connectionKeys.has(key)) {
        report.verified.push({ from: 'skello-app', to: edge.to, evidence: edge.evidence.join(', ') })
        verifiedKeys.add(key)
      } else {
        report.candidates.push({ from: 'skello-app', to: edge.to, evidence: edge.evidence.join(', '), transport: edge.transport })
      }
    }
  }

  // Reverse pass — every dataset connection needs evidence or an explanation
  for (const conn of connectivityMap.connections) {
    const key = `${conn.from}→${conn.to}`
    if (verifiedKeys.has(key)) continue

    if (!fs.existsSync(path.join(REPO_BASE, conn.from))) {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'repo not checked out locally' })
      continue
    }
    if (conn.from === 'skello-app') {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'no mapped Rails client found (heuristic scan — check RAILS_CLIENT_TARGETS)' })
      continue
    }
    if (conn.from === 'skello-app-front') {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: 'frontend HTTP calls not extracted in Phase 1' })
      continue
    }
    if (!conn.sdkPackage.startsWith('@skelloapp/')) {
      report.unverifiable.push({ from: conn.from, to: conn.to, reason: `non-npm declaration (${conn.sdkPackage})` })
      continue
    }
    report.stale.push({ from: conn.from, to: conn.to, sdkPackage: conn.sdkPackage })
  }

  report.unmappedGithubTeams = [...allSlugs].filter(s => !slugToTeamId.has(s)).sort()
  return report
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function writeOverlay(report: Report) {
  const today = new Date().toISOString().slice(0, 10)
  const overlay: DiscoveredOverlay = {
    generatedAt: new Date().toISOString(),
    scannedRepos: report.scannedRepos,
    services: report.serviceFacts,
    connections: Object.fromEntries(
      report.verified.map(v => [`${v.from}→${v.to}`, { lastVerified: today, evidence: v.evidence }]),
    ),
  }
  fs.mkdirSync(path.dirname(OVERLAY_PATH), { recursive: true })
  fs.writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2) + '\n')
  console.log(`\nOverlay written: ${path.relative(process.cwd(), OVERLAY_PATH)}`)
  console.log(`  ${Object.keys(overlay.services).length} services enriched, ${Object.keys(overlay.connections).length} connections verified`)
}

// ── Report ────────────────────────────────────────────────────────────────────

function printMarkdown(r: Report) {
  const section = (title: string, lines: string[]) => {
    console.log(`\n## ${title} (${lines.length})\n`)
    console.log(lines.length ? lines.join('\n') : '_none_')
  }

  console.log('# Discovery Report')
  console.log(`\nScanned ${r.scannedRepos.length} repos in ${REPO_BASE}`)

  section('✅ Verified connections — in map, evidence found',
    r.verified.map(v => `- ${v.from} → ${v.to} _(${v.evidence})_`))

  section('🆕 Candidates — evidence in code, missing from map (adopt via PR)',
    r.candidates.map(c => `- **${c.from} → ${c.to}** via \`${c.evidence}\` (${c.transport})`))

  section('⚠️ Possibly stale — in map, no evidence in checked-out repo',
    r.stale.map(s => `- ${s.from} → ${s.to} (\`${s.sdkPackage}\` not in package.json)`))

  section('⏭ Unverifiable — in map, cannot be checked by Phase 1 extractors',
    r.unverifiable.map(u => `- ${u.from} → ${u.to} — ${u.reason}`))

  section('❓ Unknown targets — SDK evidence pointing outside the map',
    r.unknownTargets.map(u => `- ${u.from} → \`${u.evidence}\` (resolves to "${u.normalizedTarget}")`))

  section('📦 Repos without a service definition (add to the map?)',
    r.reposWithoutServiceDefinition.map(n => `- ${n}`))

  section('🗺 Rails clients needing a mapping decision',
    r.railsUnmapped.map(f => `- ${f}`))

  section('👥 GitHub teams not mapped to any squad (extend teams.githubTeams)',
    r.unmappedGithubTeams.map(t => `- ${t}`))

  section('📚 Ignored shared libraries',
    Object.entries(r.ignoredSdks).map(([pkg, repos]) =>
      `- \`${pkg}\` — ${IGNORED_SDKS[pkg]} (${repos.length} repos)`))

  console.log(`\n## Summary\n`)
  console.log(`| verified | candidates | stale | unverifiable | unknown targets |`)
  console.log(`|---|---|---|---|---|`)
  console.log(`| ${r.verified.length} | ${r.candidates.length} | ${r.stale.length} | ${r.unverifiable.length} | ${r.unknownTargets.length} |`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const report = run()
if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2))
} else {
  printMarkdown(report)
}
if (APPLY_MODE) {
  writeOverlay(report)
}
