import * as fs from 'node:fs'
import * as path from 'node:path'

export interface TsRepoFacts {
  repo: string
  repoUrl: string
  /** All @skelloapp/*-sdk / *-client packages found in dependencies + devDependencies */
  sdkPackages: string[]
  /** GitHub team slugs found in .github/CODEOWNERS (e.g. "@skelloapp/squad-planning"), with occurrence counts */
  githubTeams: Record<string, number>
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

function extractCodeowners(repoPath: string): Record<string, number> {
  const content = readText(path.join(repoPath, '.github', 'CODEOWNERS'))
  if (!content) return {}
  const counts: Record<string, number> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const matches = trimmed.match(/@skelloapp\/[\w-]+/g)
    for (const m of matches ?? []) counts[m] = (counts[m] ?? 0) + 1
  }
  return counts
}

/** Extract facts from a TypeScript/Node repo. Returns null when there is no package.json. */
export function extractTsRepo(repoBase: string, repo: string): TsRepoFacts | null {
  const repoPath = path.join(repoBase, repo)
  const pkg = readJson(path.join(repoPath, 'package.json'))
  if (!pkg) return null

  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
    ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
  }
  const sdkPackages = Object.keys(deps)
    .filter(d => d.startsWith('@skelloapp/') && (d.includes('-sdk') || d.includes('-client')))
    .sort()

  return {
    repo,
    repoUrl: normalizeRepoUrl(pkg.repository, repo),
    sdkPackages,
    githubTeams: extractCodeowners(repoPath),
  }
}

/** CODEOWNERS extraction for repos without package.json (e.g. the Rails monolith). */
export function extractRepoOwnership(repoBase: string, repo: string): Record<string, number> {
  return extractCodeowners(path.join(repoBase, repo))
}
