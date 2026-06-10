import * as fs from 'node:fs'
import * as path from 'node:path'

export interface FrontendServiceEvidence {
  /** env var names whose value points at this service host (values are never recorded) */
  envVars: string[]
  /** source files referencing those vars or the service host directly (capped sample) */
  usageFiles: string[]
  usageCount: number
}

export interface FrontendFacts {
  /** svc host name (e.g. "svc-labour-laws") → evidence */
  services: Record<string, FrontendServiceEvidence>
}

const ENV_FILES = ['.env', '.env.local', '.env.development.local']
const SOURCE_DIRS = ['apps', 'shared', 'single-spa', 'src']
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.vue'])
const MAX_FILE_SIZE = 512 * 1024
const SAMPLE_CAP = 3

/**
 * Extract `VAR=https://svc-x...` mappings from env content.
 * Only the var name and the svc host are kept — never the value.
 * Exported for tests.
 */
export function parseEnvServiceUrls(content: string): Array<{ varName: string; service: string }> {
  const out: Array<{ varName: string; service: string }> = []
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*["']?https?:\/\/(svc-[a-z0-9-]+)\./)
    if (m) out.push({ varName: m[1]!, service: m[2]! })
  }
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
    else if (SOURCE_EXTS.has(path.extname(e.name))) out.push(full)
  }
  return out
}

/**
 * Find which svc-* services the frontend references: env vars holding service
 * URLs + usage of those vars (or direct svc hosts) in source code.
 */
export function extractFrontend(repoBase: string, repo = 'skello-app-front'): FrontendFacts | null {
  const repoPath = path.join(repoBase, repo)
  if (!fs.existsSync(repoPath)) return null

  const varsByService = new Map<string, Set<string>>()
  for (const envFile of ENV_FILES) {
    let content: string
    try {
      content = fs.readFileSync(path.join(repoPath, envFile), 'utf-8')
    } catch {
      continue
    }
    for (const { varName, service } of parseEnvServiceUrls(content)) {
      if (!varsByService.has(service)) varsByService.set(service, new Set())
      varsByService.get(service)!.add(varName)
    }
  }

  const services: Record<string, FrontendServiceEvidence> = {}
  for (const [service, vars] of varsByService) {
    services[service] = { envVars: [...vars].sort(), usageFiles: [], usageCount: 0 }
  }

  const sourceFiles = SOURCE_DIRS
    .map(d => path.join(repoPath, d))
    .filter(d => fs.existsSync(d))
    .flatMap(d => walkSourceFiles(d))

  // Env vars are typically wrapped once (`export const svcXApiUrl =
  // getUrl('VUE_APP_SVC_X_API_URL')`) and features import the derived export —
  // collect those identifiers so usage scanning sees real call sites.
  const derivedByService = new Map<string, Set<string>>()
  for (const file of sourceFiles) {
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    for (const [service, evidence] of Object.entries(services)) {
      for (const v of evidence.envVars) {
        for (const m of content.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*\\w+\\(['"]${v}['"]\\)`, 'g'))) {
          if (!derivedByService.has(service)) derivedByService.set(service, new Set())
          derivedByService.get(service)!.add(m[1]!)
        }
      }
    }
  }

  for (const file of sourceFiles) {
    let content: string
    try {
      if (fs.statSync(file).size > MAX_FILE_SIZE) continue
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const rel = path.relative(repoPath, file)

    for (const [service, evidence] of Object.entries(services)) {
      const derived = derivedByService.get(service)
      const hit = evidence.envVars.some(v => content.includes(v))
        || content.includes(`//${service}.`)
        || (derived ? [...derived].some(d => content.includes(d)) : false)
      if (hit) {
        evidence.usageCount++
        if (evidence.usageFiles.length < SAMPLE_CAP) evidence.usageFiles.push(rel)
      }
    }

    // Direct URL literals for services with no env var
    for (const m of content.matchAll(/https?:\/\/(svc-[a-z0-9-]+)\./g)) {
      const service = m[1]!
      if (!services[service]) {
        services[service] = { envVars: [], usageFiles: [rel], usageCount: 1 }
      }
    }
  }

  return Object.keys(services).length ? { services } : null
}
