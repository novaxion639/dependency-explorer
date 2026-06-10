import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * SDK registry — parses skello-libs-ts (the central Nx monorepo hosting every
 * @skelloapp package's source) into a per-SDK map of client methods to the
 * HTTP endpoints they call. This is the authoritative bridge between "repo X
 * imports the Y SDK" and "repo X uses these endpoints of service Y".
 */

export interface SdkMethod {
  name: string
  httpMethod: string
  /** path with template params normalized to {param}; may be relative (joined onto an axios baseURL) */
  path: string
}

export interface SdkRegistry {
  /** package name (@skelloapp/x) → methods discovered in its Repository/Client classes */
  packages: Map<string, SdkMethod[]>
}

const LIBS_REPO = 'skello-libs-ts'
const HTTP_CALL_RE = /\.(get|post|put|patch|delete)(?:<.*>)?\(\s*(?:[`'"]([^`'"]+)[`'"]|url\b)/
const METHOD_DECL_RE = /^\s{2}(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/
const URL_ASSIGN_RE = /\burl\s*=\s*[`'"]([^`'"]+)[`'"]/

function normalizeTemplatePath(p: string): string {
  // ${dto.token} / ${params.email} → {param}; query strings are not part of endpoint identity
  return p.replace(/\$\{[^}]+\}/g, '{param}').split('?')[0]!
}

/** Parse one Repository/Client source file for method → HTTP call mappings. Exported for tests. */
export function parseSdkSource(content: string): SdkMethod[] {
  const methods: SdkMethod[] = []
  let currentMethod: string | null = null
  let pendingUrl: string | null = null

  for (const line of content.split('\n')) {
    const decl = line.match(METHOD_DECL_RE)
    if (decl && decl[1] !== 'constructor' && decl[1] !== 'if' && decl[1] !== 'for' && decl[1] !== 'switch') {
      currentMethod = decl[1]!
      pendingUrl = null
    }

    const urlAssign = line.match(URL_ASSIGN_RE)
    if (urlAssign) pendingUrl = normalizeTemplatePath(urlAssign[1]!)

    const call = line.match(HTTP_CALL_RE)
    if (call && currentMethod) {
      const inline = call[2] ? normalizeTemplatePath(call[2]) : null
      const p = inline ?? pendingUrl
      if (p) {
        methods.push({ name: currentMethod, httpMethod: call[1]!.toUpperCase(), path: p })
        currentMethod = null // one endpoint per method — first call wins
      }
    }
  }
  return methods
}

function walkTs(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkTs(full, out)
    else if (e.name.endsWith('.ts') && !/\.(test|spec|d)\.ts$/.test(e.name)) out.push(full)
  }
  return out
}

/** Build the registry from skello-libs-ts/packages. Returns null when the repo is absent. */
export function extractSdkRegistry(repoBase: string): SdkRegistry | null {
  const packagesDir = path.join(repoBase, LIBS_REPO, 'packages')
  if (!fs.existsSync(packagesDir)) return null

  const registry: SdkRegistry = { packages: new Map() }
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json')
    let pkgName: string
    try {
      pkgName = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')).name
    } catch {
      continue
    }
    if (!pkgName?.startsWith('@skelloapp/')) continue

    const sources = [
      ...walkTs(path.join(packagesDir, entry.name, 'src', 'Repository')),
      ...walkTs(path.join(packagesDir, entry.name, 'src', 'Client')),
    ]
    const methods: SdkMethod[] = []
    for (const file of sources) {
      try {
        methods.push(...parseSdkSource(fs.readFileSync(file, 'utf-8')))
      } catch {
        // unreadable — skip
      }
    }
    registry.packages.set(pkgName, methods)
  }
  return registry
}
