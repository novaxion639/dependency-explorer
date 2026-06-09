import * as fs from 'node:fs'
import * as path from 'node:path'
import { RAILS_CLIENT_TARGETS, RAILS_CLIENT_DIR_TARGETS } from '../mapping'

export interface RailsClientEdge {
  to: string
  /** Relative paths of the client files proving this edge */
  evidence: string[]
  transport: 'rest' | 'sqs' | 'unknown'
}

export interface RailsFacts {
  edges: RailsClientEdge[]
  /** Client files/dirs present in the monolith but with no confirmed target mapping */
  unmapped: string[]
}

const CLIENTS_DIR = ['app', 'services', 'microservices']

function detectTransport(content: string): 'rest' | 'sqs' | 'unknown' {
  const hasHttp = /HTTParty|Faraday|Net::HTTP/.test(content)
  const hasSqs = /Aws::SQS|send_message|sqs/i.test(content)
  if (hasHttp) return 'rest'
  if (hasSqs) return 'sqs'
  return 'unknown'
}

/**
 * Scan skello-app's microservice client classes (app/services/microservices)
 * to find the monolith's outbound connections. Mapping is table-driven and
 * deliberately incomplete: ambiguous clients are reported, never guessed.
 */
export function extractRailsMonolith(repoBase: string, repo = 'skello-app'): RailsFacts | null {
  const clientsPath = path.join(repoBase, repo, ...CLIENTS_DIR)
  if (!fs.existsSync(clientsPath)) return null

  const edgesByTarget = new Map<string, RailsClientEdge>()
  const unmapped: string[] = []

  const addEvidence = (target: string, relPath: string, content: string) => {
    const existing = edgesByTarget.get(target)
    const transport = detectTransport(content)
    if (existing) {
      existing.evidence.push(relPath)
      if (existing.transport === 'unknown') existing.transport = transport
    } else {
      edgesByTarget.set(target, { to: target, evidence: [relPath], transport })
    }
  }

  for (const entry of fs.readdirSync(clientsPath, { withFileTypes: true })) {
    const relBase = path.join(...CLIENTS_DIR, entry.name)

    if (entry.isFile() && entry.name.endsWith('.rb')) {
      if (!(entry.name in RAILS_CLIENT_TARGETS)) {
        unmapped.push(`${relBase} (unrecognised — add to RAILS_CLIENT_TARGETS)`)
        continue
      }
      const target = RAILS_CLIENT_TARGETS[entry.name]
      if (target === null) {
        unmapped.push(`${relBase} (ambiguous target)`)
        continue
      }
      const content = fs.readFileSync(path.join(clientsPath, entry.name), 'utf-8')
      addEvidence(target!, relBase, content)
    }

    if (entry.isDirectory()) {
      if (!(entry.name in RAILS_CLIENT_DIR_TARGETS)) {
        unmapped.push(`${relBase}/ (unrecognised — add to RAILS_CLIENT_DIR_TARGETS)`)
        continue
      }
      const target = RAILS_CLIENT_DIR_TARGETS[entry.name]
      if (target === null) {
        if (entry.name !== 'transformers') unmapped.push(`${relBase}/ (ambiguous target)`)
        continue
      }
      const dirPath = path.join(clientsPath, entry.name)
      const rbFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.rb'))
      const content = rbFiles
        .map(f => fs.readFileSync(path.join(dirPath, f), 'utf-8'))
        .join('\n')
      addEvidence(target!, `${relBase}/`, content)
    }
  }

  return { edges: [...edgesByTarget.values()], unmapped: unmapped.sort() }
}
