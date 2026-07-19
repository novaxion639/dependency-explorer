import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Generated TSOA specs — the checked-in tmp/swagger.json each svc-* ships
 * (the `swagger` npm script runs on postinstall/predeploy). The facts are
 * "METHOD /path" keys: operationIds repeat across controllers, so the
 * method+path pair is the unique, verifiable contract identity (📜).
 */
export interface SwaggerFacts {
  /** "METHOD /path" → operationId */
  operations: Map<string, string>
}

export function extractSwagger(repoBase: string, repo: string): SwaggerFacts | null {
  const specPath = path.join(repoBase, repo, 'tmp', 'swagger.json')
  if (!fs.existsSync(specPath)) return null
  let spec: any
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'))
  } catch {
    return null
  }
  const operations = new Map<string, string>()
  for (const [p, ops] of Object.entries<any>(spec?.paths ?? {})) {
    for (const [method, op] of Object.entries<any>(ops)) {
      if (op && typeof op === 'object') {
        operations.set(`${method.toUpperCase()} ${p}`, typeof op.operationId === 'string' ? op.operationId : '')
      }
    }
  }
  return operations.size ? { operations } : null
}
