import type { checkStateMachines } from './state-machine-check'

export function machineSection(mc: ReturnType<typeof checkStateMachines>): string {
  return [
    `\n## ⚙ State machines (${mc.findings.length} findings)\n`,
    `${mc.verified} state(s) verified against their definitions.` + (mc.skippedRepos.length ? ` Skipped (repo not checked out): ${mc.skippedRepos.join(', ')}.` : ''),
    ...mc.findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`),
  ].join('\n')
}
