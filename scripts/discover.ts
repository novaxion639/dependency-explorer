/**
 * Auto-discovery script — scans local Skello repos to discover service metadata.
 *
 * Usage:
 *   npx tsx scripts/discover.ts              # Full diff report
 *   npx tsx scripts/discover.ts --json       # JSON output
 *
 * What it discovers:
 *   - Service-to-service connections from @skelloapp/*-sdk dependencies
 *   - Repository URLs from package.json
 *   - Communication type inference (sync/async) from SDK patterns
 *   - CODEOWNERS team indicators
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap } from '../src/data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_BASE = path.resolve(__dirname, '../../')
const JSON_MODE = process.argv.includes('--json')

interface DiscoveredConnection {
  from: string
  to: string
  sdkPackage: string
  inferredType: 'sync' | 'async'
}

interface DiscoveryReport {
  repoUrls: Record<string, string>
  discoveredConnections: DiscoveredConnection[]
  newConnections: DiscoveredConnection[]
  missingFromCode: Array<{ from: string; to: string; sdkPackage: string }>
  codeowners: Record<string, string[]>
}

function findRepos(): string[] {
  try {
    const entries = fs.readdirSync(REPO_BASE, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && (e.name.startsWith('svc-') || ['skello-app', 'skello-app-front', 'superadmin'].includes(e.name)))
      .map(e => e.name)
      .sort()
  } catch {
    return []
  }
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function extractSdkDeps(pkgJson: Record<string, unknown>): string[] {
  const deps = { ...(pkgJson.dependencies as Record<string, string> ?? {}), ...(pkgJson.devDependencies as Record<string, string> ?? {}) }
  return Object.keys(deps).filter(d => d.startsWith('@skelloapp/') && (d.includes('-sdk') || d.includes('-client')))
}

function sdkToServiceName(sdkPkg: string): string | null {
  // @skelloapp/svc-events-sdk -> svc-events
  // @skelloapp/svc-employees-client -> svc-employees
  // @skelloapp/svc-documents-v2-client -> svc-documents-v2
  // @skelloapp/workload-plan-sdk -> svc-workload-plan
  const name = sdkPkg.replace('@skelloapp/', '').replace(/-sdk$/, '').replace(/-client$/, '')
  // Normalize: add svc- prefix if missing
  const normalized = name.startsWith('svc-') ? name : `svc-${name}`
  return normalized
}

function extractRepoUrl(pkgJson: Record<string, unknown>): string | null {
  const repo = pkgJson.repository
  if (typeof repo === 'string') return repo
  if (repo && typeof repo === 'object' && 'url' in (repo as Record<string, unknown>)) {
    return (repo as Record<string, string>).url ?? null
  }
  return null
}

function extractCodeowners(repoPath: string): string[] {
  const content = readText(path.join(repoPath, '.github', 'CODEOWNERS'))
  if (!content) return []
  const teams = new Set<string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const matches = trimmed.match(/@skelloapp\/[\w-]+/g)
    if (matches) matches.forEach(m => teams.add(m))
  }
  return [...teams]
}

function run(): DiscoveryReport {
  const repos = findRepos()
  const existingConnections = new Set(
    connectivityMap.connections.map(c => `${c.from}→${c.to}`)
  )
  const existingSdkMap = new Map(
    connectivityMap.connections.map(c => [`${c.from}→${c.to}`, c.sdkPackage])
  )

  const report: DiscoveryReport = {
    repoUrls: {},
    discoveredConnections: [],
    newConnections: [],
    missingFromCode: [],
    codeowners: {},
  }

  for (const repoName of repos) {
    const repoPath = path.join(REPO_BASE, repoName)
    const pkgJson = readJson(path.join(repoPath, 'package.json'))
    if (!pkgJson) continue

    // Repo URL
    const repoUrl = extractRepoUrl(pkgJson)
    if (repoUrl) {
      report.repoUrls[repoName] = repoUrl
    } else {
      // Infer from org convention
      report.repoUrls[repoName] = `https://github.com/skello/${repoName}`
    }

    // SDK dependencies -> connections
    const sdkDeps = extractSdkDeps(pkgJson)
    for (const sdk of sdkDeps) {
      const targetService = sdkToServiceName(sdk)
      if (!targetService || targetService === repoName) continue

      const conn: DiscoveredConnection = {
        from: repoName,
        to: targetService,
        sdkPackage: sdk,
        inferredType: 'sync',
      }
      report.discoveredConnections.push(conn)

      if (!existingConnections.has(`${repoName}→${targetService}`)) {
        report.newConnections.push(conn)
      }
    }

    // CODEOWNERS
    const owners = extractCodeowners(repoPath)
    if (owners.length > 0) {
      report.codeowners[repoName] = owners
    }
  }

  // Find connections in our data that have SDK packages not found in package.json
  for (const conn of connectivityMap.connections) {
    if (conn.sdkPackage.startsWith('@skelloapp/')) {
      const repoPath = path.join(REPO_BASE, conn.from)
      const pkgJson = readJson(path.join(repoPath, 'package.json'))
      if (pkgJson) {
        const deps = extractSdkDeps(pkgJson)
        if (!deps.includes(conn.sdkPackage)) {
          report.missingFromCode.push({
            from: conn.from,
            to: conn.to,
            sdkPackage: conn.sdkPackage,
          })
        }
      }
    }
  }

  return report
}

function printMarkdown(report: DiscoveryReport) {
  console.log('# Discovery Report\n')
  console.log(`Scanned repos in: ${REPO_BASE}\n`)

  // New connections
  console.log(`## New Connections Discovered (${report.newConnections.length})\n`)
  if (report.newConnections.length === 0) {
    console.log('No new connections found.\n')
  } else {
    for (const conn of report.newConnections) {
      console.log(`- **${conn.from}** -> **${conn.to}** via \`${conn.sdkPackage}\``)
    }
    console.log()
  }

  // Missing from code
  console.log(`## Connections in Data but SDK Not Found in package.json (${report.missingFromCode.length})\n`)
  if (report.missingFromCode.length === 0) {
    console.log('All @skelloapp/* SDK connections verified.\n')
  } else {
    for (const m of report.missingFromCode) {
      console.log(`- ${m.from} -> ${m.to} (\`${m.sdkPackage}\` not in package.json)`)
    }
    console.log()
  }

  // Repo URLs
  console.log(`## Repo URLs (${Object.keys(report.repoUrls).length})\n`)
  for (const [name, url] of Object.entries(report.repoUrls).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${name}: ${url}`)
  }
  console.log()

  // CODEOWNERS
  console.log(`## CODEOWNERS Teams (${Object.keys(report.codeowners).length} repos)\n`)
  for (const [name, owners] of Object.entries(report.codeowners).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${name}: ${owners.join(', ')}`)
  }
  console.log()

  // Summary
  console.log('## Summary\n')
  console.log(`- Total discovered connections: ${report.discoveredConnections.length}`)
  console.log(`- New (not in data): ${report.newConnections.length}`)
  console.log(`- Stale (in data, not in code): ${report.missingFromCode.length}`)
  console.log(`- Repos with URLs: ${Object.keys(report.repoUrls).length}`)
  console.log(`- Repos with CODEOWNERS: ${Object.keys(report.codeowners).length}`)
}

const report = run()
if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2))
} else {
  printMarkdown(report)
}
