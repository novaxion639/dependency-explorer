import type { CodeEdgeGrade, FlowCodeEdge } from '@dependency-explorer/data'

const MODE: Record<NonNullable<FlowCodeEdge['mode']>, string> = { sync: 'sync', 'async-job': 'background job', 'async-event': 'event' }
const VERIFIED = '✓ verified in the call graph'
const GRADE: Record<CodeEdgeGrade, string> = { graph: VERIFIED, constant: VERIFIED, import: VERIFIED, text: '~ name match only', none: '✗ no evidence in code' }

export function edgeFacts(flowId: string, e: FlowCodeEdge, grades: Record<string, CodeEdgeGrade>): string[] {
  const grade = grades[`${flowId}#${e.from}→${e.to}`]
  const auth = e.auth?.gate ?? e.auth?.tokenType
  return [
    MODE[e.mode ?? 'sync'],
    ...(e.inTransaction ? ['in transaction'] : []),
    ...(e.crud?.length ? [`CRUD ${e.crud.map(c => c.slice(0, 1).toUpperCase()).join('')}`] : []),
    ...(e.condition ? [`if ${e.condition}`] : []),
    ...(e.flags ?? []).map(f => `🚩 ${f.name}`),
    ...(grade ? [GRADE[grade]] : []),
    ...(auth ? [`🔑 ${auth}`] : []),
    ...(e.failure?.dlq ? [`🛡 DLQ ${e.failure.dlq}`] : e.failure?.dlqAbsent ? ['⚠ no DLQ'] : []),
    ...(e.pii?.length ? [`🧬 PII ${e.pii.join(', ')}`] : []),
    ...(e.contractRefs ?? []).map(c => `📜 ${c}`),
  ]
}
