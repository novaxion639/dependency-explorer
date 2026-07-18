import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * How an SDK dependency is actually imported in the repo's source:
 *  - value: at least one runtime import → real client usage
 *  - type-only: only `import type` statements → types reuse, NOT a runtime call
 *  - declared-only: in package.json but never imported under src/
 */
export type SdkUsage = 'value' | 'type-only' | 'declared-only'

export interface CodeownersFacts {
  /** all team slugs seen anywhere in CODEOWNERS, with occurrence counts */
  counts: Record<string, number>
  /** slugs on the wildcard (`*`) line — the only real repo-ownership signal */
  wildcardOwners: string[]
}

export interface TsRepoFacts {
  repo: string
  repoUrl: string
  /** All @skelloapp/*-sdk / *-client packages found in dependencies + devDependencies */
  sdkPackages: string[]
  /** Import-level usage classification per SDK package */
  sdkUsage: Record<string, SdkUsage>
  codeowners: CodeownersFacts
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

function normalizeRepoUrl(raw: unknown, repo: string): string {
  let url: string | null = null
  if (typeof raw === 'string') url = raw
  else if (raw && typeof raw === 'object' && 'url' in raw) {
    url = (raw as Record<string, string>).url ?? null
  }
  if (!url) return `https://github.com/skelloapp/${repo}`
  return url.replace(/^git\+/, '').replace(/\.git$/, '')
}

function extractCodeowners(repoPath: string): CodeownersFacts {
  const content = readText(path.join(repoPath, '.github', 'CODEOWNERS'))
  const facts: CodeownersFacts = { counts: {}, wildcardOwners: [] }
  if (!content) return facts
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const matches = trimmed.match(/@skelloapp\/[\w-]+/g) ?? []
    for (const m of matches) facts.counts[m] = (facts.counts[m] ?? 0) + 1
    if (/^\*\s/.test(trimmed)) facts.wildcardOwners.push(...matches)
  }
  return facts
}

/** Classify how `pkg` is imported in a source string. Exported for tests. */
export function classifyImports(content: string, pkg: string): 'value' | 'type-only' | 'none' {
  const escaped = pkg.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&')
  const importRe = new RegExp(`import\\s+(type\\s+)?[^;'"]*?from\\s+['"]${escaped}(/[^'"]*)?['"]`, 'g')
  let sawTypeOnly = false
  for (const m of content.matchAll(importRe)) {
    if (m[1]) sawTypeOnly = true
    else return 'value'
  }
  if (new RegExp(`require\\(['"]${escaped}(/[^'"]*)?['"]\\)`).test(content)) return 'value'
  return sawTypeOnly ? 'type-only' : 'none'
}

/**
 * Directories holding a package.json, repo root included. Some repos are
 * multi-package without a root manifest (e.g. svc-skello-assistant keeps its
 * deployable under serverless/) — scanning only the root misses their SDK deps.
 */
export function findPackageDirs(repoPath: string, maxDepth = 3): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (entries.some(e => e.isFile() && e.name === 'package.json')) out.push(dir)
    if (depth >= maxDepth) return
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
      walk(path.join(dir, e.name), depth + 1)
    }
  }
  walk(repoPath, 0)
  return out
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSourceFiles(full, out)
    else if (/\.(ts|tsx|js|vue)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(full)
  }
  return out
}

function classifySdkUsage(pkgDirs: string[], sdkPackages: string[]): Record<string, SdkUsage> {
  const usage: Record<string, SdkUsage> = Object.fromEntries(sdkPackages.map(p => [p, 'declared-only' as SdkUsage]))
  if (!sdkPackages.length) return usage
  const files = pkgDirs.flatMap(dir => walkSourceFiles(path.join(dir, 'src')))
  const pending = new Set(sdkPackages)
  for (const file of files) {
    if (!pending.size) break
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    for (const pkg of [...pending]) {
      const cls = classifyImports(content, pkg)
      if (cls === 'value') {
        usage[pkg] = 'value'
        pending.delete(pkg) // strongest verdict — stop looking
      } else if (cls === 'type-only' && usage[pkg] === 'declared-only') {
        usage[pkg] = 'type-only' // keep scanning, a value import elsewhere wins
      }
    }
  }
  return usage
}

/** Extract facts from a TypeScript/Node repo. Returns null when no package.json exists anywhere. */
export function extractTsRepo(repoBase: string, repo: string): TsRepoFacts | null {
  const repoPath = path.join(repoBase, repo)
  const pkgDirs = findPackageDirs(repoPath)
  if (!pkgDirs.length) return null

  const sdkSet = new Set<string>()
  let repoUrlRaw: unknown
  for (const dir of pkgDirs) {
    const pkg = readJson(path.join(dir, 'package.json'))
    if (!pkg) continue
    if (pkg.repository && (dir === repoPath || repoUrlRaw === undefined)) repoUrlRaw = pkg.repository
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
      ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
    }
    for (const d of Object.keys(deps)) {
      // '-js' covers the mobile SDK flavor (@skelloapp/svc-punch-js)
      if (d.startsWith('@skelloapp/') && (d.includes('-sdk') || d.includes('-client') || d.endsWith('-js'))) sdkSet.add(d)
    }
  }
  const sdkPackages = [...sdkSet].sort()

  return {
    repo,
    repoUrl: normalizeRepoUrl(repoUrlRaw, repo),
    sdkPackages,
    sdkUsage: classifySdkUsage(pkgDirs, sdkPackages),
    codeowners: extractCodeowners(repoPath),
  }
}

/** CODEOWNERS extraction for repos without package.json (e.g. the Rails monolith). */
export function extractRepoOwnership(repoBase: string, repo: string): CodeownersFacts {
  return extractCodeowners(path.join(repoBase, repo))
}
