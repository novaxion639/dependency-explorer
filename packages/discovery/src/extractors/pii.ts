import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * PII surface facts — decorator-first, per the Flow Expressiveness
 * evaluation (docs/improvements/roadmap.md §9): `@skelloapp/lib-anonymizer`
 * decorators are explicit, human-declared, machine-readable per-field PII
 * typing (@RandomAnonymizer/@PasswordAnonymizer/@DeleteAnonymizer = PII;
 * @NoAnonymizer = explicitly not). They are the AUTHORITATIVE source; the
 * name-heuristic sweep over packages without decorators is REVIEW-ASSIST only —
 * its hit density is inverted vs stakes (payroll/HRIS DTOs are sync
 * bookkeeping), so it flags candidates for humans, never facts.
 */

export interface PiiFieldFact {
  pkg: string
  file: string
  field: string
  anonymizer: 'RandomAnonymizer' | 'PasswordAnonymizer' | 'DeleteAnonymizer'
  format?: string
}

export interface PiiCandidate {
  pkg: string
  file: string
  field: string
}

export interface PiiFacts {
  /** decorator-typed PII fields (authoritative) */
  piiTyped: PiiFieldFact[]
  /** fields explicitly declared non-PII via @NoAnonymizer */
  explicitNonPii: number
  /** packages carrying any anonymizer decorators */
  decoratedPackages: string[]
  /** name-heuristic candidates in packages WITHOUT decorator coverage — review-assist */
  candidates: PiiCandidate[]
}

const DECORATOR_RE = /@(RandomAnonymizer|PasswordAnonymizer|DeleteAnonymizer|NoAnonymizer)\(([^)]*)\)\s*\n\s*(?:public |readonly |private )*([A-Za-z_]\w*)/g
const PII_NAME_RE = /^(email|e?mail\w*|first_?name|last_?name|maiden_?name|phone\w*|iban|bic|ssn|nir|social_?security\w*|birth_?date|date_?of_?birth|address\w*|nationality|gender|bank_?account\w*|userEmail|recipientEmail|recipientFirstName|recipientLastName)$/i
const FIELD_DECL_RE = /^\s*(?:public |readonly |private )*([A-Za-z_]\w*)\??[!:]\s*(?:string|String)/

function walkTs(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'tests' || e.name === '__tests__') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkTs(full, out)
    else if (e.name.endsWith('.ts') && !e.name.includes('.spec.') && !e.name.includes('.test.')) out.push(full)
  }
  return out
}

export function extractPiiFacts(repoBase: string, libsRepo = 'skello-libs-ts'): PiiFacts | null {
  const pkgsDir = path.join(repoBase, libsRepo, 'packages')
  if (!fs.existsSync(pkgsDir)) return null

  const facts: PiiFacts = { piiTyped: [], explicitNonPii: 0, decoratedPackages: [], candidates: [] }
  const decorated = new Set<string>()
  const candidateFiles = new Map<string, PiiCandidate[]>()

  for (const pkg of fs.readdirSync(pkgsDir)) {
    if (pkg === 'lib-anonymizer') continue // the library itself, not a data contract
    const src = path.join(pkgsDir, pkg, 'src')
    for (const file of walkTs(src)) {
      const rel = path.relative(pkgsDir, file)
      let content: string
      try {
        content = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }

      let hasDecorators = false
      for (const m of content.matchAll(DECORATOR_RE)) {
        hasDecorators = true
        decorated.add(pkg)
        const [, kind, arg, field] = m
        if (kind === 'NoAnonymizer') {
          facts.explicitNonPii++
        } else {
          facts.piiTyped.push({
            pkg, file: rel, field: field!,
            anonymizer: kind as PiiFieldFact['anonymizer'],
            format: arg?.match(/RandomAnonymizerFormat\.(\w+)/)?.[1],
          })
        }
      }

      // Heuristic sweep — only meaningful where decorators are absent
      if (!hasDecorators && /\/(Dto|Entity|Model)\//.test(file)) {
        for (const line of content.split('\n')) {
          const decl = line.match(FIELD_DECL_RE)
          if (decl && PII_NAME_RE.test(decl[1]!)) {
            const list = candidateFiles.get(pkg) ?? []
            list.push({ pkg, file: rel, field: decl[1]! })
            candidateFiles.set(pkg, list)
          }
        }
      }
    }
  }

  for (const [pkg, list] of candidateFiles) {
    if (!decorated.has(pkg)) facts.candidates.push(...list)
  }
  facts.decoratedPackages = [...decorated].sort()
  return facts
}
