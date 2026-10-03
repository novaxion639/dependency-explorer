import type { FlowChapter, ServiceFlow } from '@dependency-explorer/schema'

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}

export function flowRefIds(flow: ServiceFlow): Set<string> {
  return new Set([
    ...(flow.codeUnits ?? []).map(u => u.id),
    ...(flow.infraNodes ?? []).map(n => n.id),
    ...flow.steps.flatMap(s => [s.from, s.to]),
    ...(flow.codeEdges ?? []).flatMap(e => [e.from, e.to]),
  ])
}

export function deriveChapters(flow: ServiceFlow): FlowChapter[] {
  const stores = new Set((flow.infraNodes ?? []).map(n => n.id))
  const jobs = (flow.codeEdges ?? []).filter(e => e.mode === 'async-job')
  const feeds = (flow.codeEdges ?? []).filter(e => stores.has(e.from))
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    ...flow.steps.map((s, i) => ({ title: `Step ${i + 1}`, summary: s.action, refs: unique([s.from, s.to]) })),
    ...(jobs.length ? [{ title: 'Side effects', summary: `${plural(jobs.length, 'background job')} run after the request`, refs: unique(jobs.flatMap(e => [e.from, e.to])) }] : []),
    ...(feeds.length ? [{ title: 'Replication', summary: `${plural(feeds.length, 'data feed')} copy data out of the stores`, refs: unique(feeds.flatMap(e => [e.from, e.to])) }] : []),
  ]
}

export function flowChapters(flow: ServiceFlow): { chapters: FlowChapter[]; authored: boolean } {
  return flow.chapters ? { chapters: flow.chapters, authored: true } : { chapters: deriveChapters(flow), authored: false }
}
