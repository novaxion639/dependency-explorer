import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ConnectivityMap } from '@dependency-explorer/schema'
import { stripComments } from './code-grades'

export interface BranchFinding { flow: string; kind: 'missing-branch-literal'; subject: string; detail: string }

export function checkBranches(map: ConnectivityMap, repoBase: string) {
  const findings: BranchFinding[] = []
  const skipped = new Set<string>()
  let verified = 0
  for (const flow of map.flows) {
    const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
    for (const branch of flow.branches ?? []) {
      const unit = units.get(branch.at)
      if (!unit?.path) {
        continue
      }
      if (!fs.existsSync(path.join(repoBase, unit.service))) {
        skipped.add(unit.service)
        continue
      }
      const file = path.join(repoBase, unit.service, unit.path)
      const source = fs.existsSync(file) ? stripComments(fs.readFileSync(file, 'utf-8')) : ''
      if (source.includes(branch.evidence.literal)) {
        verified++
      } else {
        findings.push({ flow: flow.id, kind: 'missing-branch-literal', subject: `${flow.id}#${branch.id}`, detail: `"${branch.evidence.literal}" not in ${unit.service}/${unit.path}` })
      }
    }
  }
  return { findings, verified, skippedRepos: [...skipped].sort() }
}
