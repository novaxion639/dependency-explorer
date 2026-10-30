import type { ListenerCheck } from './listener-check'
import type { checkStateMachines } from './state-machine-check'

function findingSection(heading: string, summary: string, findings: Array<{ kind: string; subject: string; detail: string }>): string {
  return [`\n## ${heading} (${findings.length} findings)\n`, summary, ...findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`)].join('\n')
}

export function listenerSection(c: ListenerCheck): string {
  return findingSection('👂 Listener drift', c.skipped ? 'Skipped: skello-app is not pinned.' : `${c.listeners} listener(s), ${c.writeSites} write site(s)${c.feeds === null ? '' : `, ${c.feeds} CDC feed(s)`} at the pinned commit.`, c.findings)
}

export function machineSection(mc: ReturnType<typeof checkStateMachines>): string {
  return findingSection('⚙ State machines', `${mc.verified} state(s) verified against their definitions.` + (mc.skippedRepos.length ? ` Skipped (repo not checked out): ${mc.skippedRepos.join(', ')}.` : ''), mc.findings)
}
