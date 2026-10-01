import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ExternalSystem, ProductArea } from '@dependency-explorer/schema'
import { areasForFile, globToRegExp } from '@dependency-explorer/data'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'tmp', 'coverage', 'graphify-out', 'vendor', '.serverless', 'ios', 'android', 'log', 'public', '.venv', 'venv', 'site-packages', '__pycache__'])
const CODE_FILE = /\.(rb|ts|tsx|js|jsx|mjs|vue|py)$/
const TEST_FILE = /(^|\/)(__tests__|spec|test)\/|[._](spec|test)\.[a-z]+$/
const SOURCE_FILE = /\.(rb|ts|tsx|js|mjs|vue|yml|yaml|json)$|(^|\/)\.env\.example$/
const MAX_SCANNED_BYTES = 1_000_000

export const COVERAGE_ROOTS: Record<string, string[]> = {
  'skello-app': ['app/controllers/**/*.rb', 'app/services/**/*.rb', 'app/models/**/*.rb', 'app/jobs/**/*.rb'],
  'skello-app-front': ['apps/*/src/**/*.ts', 'apps/*/src/**/*.tsx', 'apps/*/src/**/*.vue', 'apps/*/src/**/*.js'],
  'skello-mobile': ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'],
  'skello-punchclock': ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'],
  superadmin: ['src/**/*.vue', 'src/**/*.js', 'src/**/*.ts'],
}

type Evidence = ExternalSystem['usedBy'][number]['evidence']

export interface AreaCheckFinding {
  kind: 'dead-glob' | 'empty-reading-path' | 'missing-anchor' | 'anchor-symbol-absent' | 'missing-external-evidence'
  subject: string
  detail: string
}

export interface AreaCheckResult {
  findings: AreaCheckFinding[]
  coverage: Record<string, { mapped: number; total: number; unmappedByDir: Array<{ dir: string; files: number }> }>
  overlaps: Array<{ repo: string; file: string; areas: string[] }>
  areaFiles: Record<string, Record<string, number>>
  anchorsVerified: number
  evidenceVerified: number
  skippedRepos: string[]
}

export function listRepoFiles(repoDir: string): string[] {
  const out: string[] = []
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(repoDir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(p)
      } else if (entry.isFile()) {
        out.push(p)
      }
    }
  }
  walk('')
  return out
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

export function symbolPattern(symbol: string): RegExp {
  return new RegExp(`\\b(class|module|interface|type|enum|const|function)\\s+${escapeRegExp(symbol)}\\b`)
}

function closestLiveDir(glob: string, files: string[]): string {
  let dir = glob.split(/[*?]/)[0]?.replace(/\/[^/]*$/, '') ?? ''
  while (dir && !files.some(f => f.startsWith(`${dir}/`))) {
    dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : ''
  }
  return dir || '(repo root)'
}

function readSmall(file: string): string | null {
  return fs.statSync(file).size > MAX_SCANNED_BYTES ? null : fs.readFileSync(file, 'utf-8')
}

function evidenceFound(repoDir: string, files: string[], evidence: Evidence): boolean {
  const candidates = evidence.kind === 'gem' ? files.filter(f => f === 'Gemfile')
    : evidence.kind === 'npm' ? files.filter(f => f === 'package.json')
      : files.filter(f => SOURCE_FILE.test(f))
  const needle = evidence.kind === 'gem' ? new RegExp(`gem ['"]${escapeRegExp(evidence.literal)}['"]`)
    : evidence.kind === 'npm' ? new RegExp(`"${escapeRegExp(evidence.literal)}"\\s*:`)
      : null
  return candidates.some(f => {
    const content = readSmall(path.join(repoDir, f))
    if (content === null) {
      return false
    }
    return needle ? needle.test(content) : content.includes(evidence.literal)
  })
}

export function checkAreas(input: {
  areas: ProductArea[]
  externals: ExternalSystem[]
  repoBase: string
  coverageRoots: Record<string, string[]>
}): AreaCheckResult {
  const { areas, externals, repoBase, coverageRoots } = input
  const result: AreaCheckResult = { findings: [], coverage: {}, overlaps: [], areaFiles: {}, anchorsVerified: 0, evidenceVerified: 0, skippedRepos: [] }
  const skipped = new Set<string>()
  const listings = new Map<string, string[] | null>()
  const filesOf = (repo: string): string[] | null => {
    if (!listings.has(repo)) {
      const dir = path.join(repoBase, repo)
      listings.set(repo, fs.existsSync(dir) ? listRepoFiles(dir) : null)
    }
    const files = listings.get(repo) ?? null
    if (!files) {
      skipped.add(repo)
    }
    return files
  }

  for (const area of areas) {
    const counts: Record<string, number> = {}
    for (const loc of area.codeLocations) {
      const files = filesOf(loc.repo)
      if (!files) {
        continue
      }
      for (const glob of loc.globs) {
        const re = globToRegExp(glob)
        const matched = files.filter(f => re.test(f))
        counts[`${loc.repo}:${glob}`] = matched.filter(f => CODE_FILE.test(f)).length
        if (matched.length === 0) {
          result.findings.push({ kind: 'dead-glob', subject: area.id, detail: `${loc.repo}:${glob} matches no file — closest live directory: ${closestLiveDir(glob, files)}` })
        }
      }
    }
    result.areaFiles[area.id] = counts
    if (area.kind === 'product' && area.readingPath.length === 0) {
      result.findings.push({ kind: 'empty-reading-path', subject: area.id, detail: 'no reading path yet — backlog' })
    }
  }

  for (const [repo, roots] of Object.entries(coverageRoots)) {
    const files = filesOf(repo)
    if (!files) {
      continue
    }
    const rootRes = roots.map(globToRegExp)
    const inScope = files.filter(f => rootRes.some(r => r.test(f)) && !TEST_FILE.test(f))
    const unmapped = new Map<string, number>()
    let mapped = 0
    for (const file of inScope) {
      const hit = areasForFile(repo, file, areas)
      if (hit.length) {
        mapped++
      } else {
        const dir = path.posix.dirname(file)
        unmapped.set(dir, (unmapped.get(dir) ?? 0) + 1)
      }
      const product = hit.filter(a => a.kind === 'product')
      if (product.length > 1) {
        result.overlaps.push({ repo, file, areas: product.map(a => a.id) })
      }
    }
    result.coverage[repo] = {
      mapped,
      total: inScope.length,
      unmappedByDir: [...unmapped].map(([dir, n]) => ({ dir, files: n })).sort((a, b) => b.files - a.files),
    }
  }

  for (const area of areas) {
    for (const term of area.glossary) {
      if (!term.anchor || !filesOf(term.anchor.repo)) {
        continue
      }
      const subject = `${area.id}:${term.term}`
      const full = path.join(repoBase, term.anchor.repo, term.anchor.path)
      if (!fs.existsSync(full)) {
        result.findings.push({ kind: 'missing-anchor', subject, detail: `${term.anchor.repo}/${term.anchor.path} does not exist` })
      } else if (!symbolPattern(term.anchor.symbol).test(fs.readFileSync(full, 'utf-8'))) {
        result.findings.push({ kind: 'anchor-symbol-absent', subject, detail: `no declaration of ${term.anchor.symbol} in ${term.anchor.repo}/${term.anchor.path}` })
      } else {
        result.anchorsVerified++
      }
    }
  }

  for (const ext of externals) {
    for (const use of ext.usedBy) {
      const files = filesOf(use.service)
      if (!files) {
        continue
      }
      if (evidenceFound(path.join(repoBase, use.service), files, use.evidence)) {
        result.evidenceVerified++
      } else {
        result.findings.push({ kind: 'missing-external-evidence', subject: ext.id, detail: `${use.evidence.kind} "${use.evidence.literal}" not found in ${use.service}` })
      }
    }
  }

  result.skippedRepos = [...skipped].sort()
  return result
}
