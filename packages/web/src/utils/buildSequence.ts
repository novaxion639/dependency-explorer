import type { ServiceFlow } from '@dependency-explorer/data'

export interface SequenceParticipant { id: string; label: string; service: string }
export interface SequenceMessage { n: number; from: string; to: string; label: string; async: boolean; crud: string[]; badges: string[] }
export interface SequenceBranch { afterMessage: number; at: string; text: string }

type RawMessage = Omit<SequenceMessage, 'n'>

export function buildSequence(flow: ServiceFlow): { participants: SequenceParticipant[]; messages: SequenceMessage[]; branches: SequenceBranch[] } {
  const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
  const codeEdges = flow.codeEdges ?? []
  const raw: RawMessage[] = codeEdges.length > 0
    ? codeEdges.map(e => ({
        from: e.from, to: e.to, label: e.label ?? '', async: e.mode !== 'sync', crud: e.crud ?? [],
        badges: [
          ...(e.flags ?? []).map(f => `🚩 ${f.name}`),
          ...(e.auth && (e.auth.gate ?? e.auth.tokenType) ? [`🔑 ${e.auth.gate ?? e.auth.tokenType}`] : []),
        ],
      }))
    : flow.steps.map(s => ({ from: s.from, to: s.to, label: s.action, async: false, crud: [], badges: [] }))
  const order: string[] = []
  for (const m of raw) {
    for (const id of [m.from, m.to]) {
      if (!order.includes(id)) {
        order.push(id)
      }
    }
  }
  const participants: SequenceParticipant[] = order.map(id => {
    const unit = units.get(id)
    return { id, label: unit?.label ?? id, service: unit?.service ?? id }
  })
  const messages: SequenceMessage[] = raw.map((m, i) => ({ n: i + 1, ...m }))
  const branches: SequenceBranch[] = (flow.branches ?? []).flatMap(b => {
    const service = units.get(b.at)?.service
    const entering = messages.find(m => m.to === b.at) ?? messages.find(m => m.to === service)
    if (!entering) {
      return []
    }
    return [{ afterMessage: entering.n, at: b.at, text: `[${b.when}] → ${b.outcome}${b.status ? ` (${b.status})` : ''}` }]
  })
  return { participants, messages, branches }
}
