import type { ListenerCheck } from './listener-check'

export function listenerSection(c: ListenerCheck): string {
  return [
    `\n## 👂 Listener drift (${c.findings.length} findings)\n`,
    c.skipped ? 'Skipped: skello-app is not pinned.' : `${c.listeners} listener(s), ${c.writeSites} write site(s)${c.feeds === null ? '' : `, ${c.feeds} CDC feed(s)`} at the pinned commit.`,
    ...c.findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`),
  ].join('\n')
}
