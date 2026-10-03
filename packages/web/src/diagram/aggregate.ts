import type { Protocol, ServiceConnection } from '@dependency-explorer/data'
import { edgeKey } from '../hooks/useUrlState'
import { edgeMode, type DiagramEdge, type EdgeMode } from './model'

const PROTOCOL_LABEL: Record<Protocol, string> = {
  rest: 'REST', sqs: 'SQS', sns: 'SNS', kinesis: 'Kinesis', cdc: 'CDC', webhook: 'Webhook', grpc: 'gRPC', mongodb: 'MongoDB', postgresql: 'Postgres', s3: 'S3',
}
const MODE_ORDER: EdgeMode[] = ['sync', 'async', 'data-feed']

interface Bucket { from: string; to: string; mode: EdgeMode; conns: ServiceConnection[] }

export function edgeLabel(conns: ServiceConnection[]): string {
  const counts = new Map<Protocol, number>()
  for (const c of conns) {
    counts.set(c.protocol, (counts.get(c.protocol) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([p, n]) => (n > 1 ? `${PROTOCOL_LABEL[p]} ×${n}` : PROTOCOL_LABEL[p]))
    .join(' · ')
}

export function connectionsRef(conns: ServiceConnection[]): { type: 'connections'; keys: string[] } {
  return { type: 'connections', keys: conns.map(c => edgeKey(c.from, c.to, c.protocol)) }
}

export function aggregateEdges(
  conns: ServiceConnection[],
  ends: (c: ServiceConnection) => readonly [string, string] | null,
): DiagramEdge[] {
  const buckets = new Map<string, Bucket>()
  for (const c of conns) {
    const pair = ends(c)
    if (!pair || pair[0] === pair[1]) {
      continue
    }
    const mode = edgeMode(c)
    const key = `${pair[0]}|${pair[1]}|${mode}`
    const bucket = buckets.get(key) ?? { from: pair[0], to: pair[1], mode, conns: [] }
    bucket.conns.push(c)
    buckets.set(key, bucket)
  }
  const pairs = new Map<string, Bucket[]>()
  for (const b of buckets.values()) {
    const key = [b.from, b.to].sort().join('|')
    pairs.set(key, [...(pairs.get(key) ?? []), b])
  }
  const edges: DiagramEdge[] = []
  for (const group of pairs.values()) {
    const ordered = [...group].sort((a, b) => Number(a.from > a.to) - Number(b.from > b.to) || MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode))
    ordered.forEach((b, i) => {
      edges.push({
        id: `${b.from}>${b.to}:${b.mode}`,
        from: b.from,
        to: b.to,
        mode: b.mode,
        weight: b.conns.length,
        label: edgeLabel(b.conns),
        directed: true,
        lane: b.from < b.to ? i : ordered.length - 1 - i,
        lanes: ordered.length,
        ref: connectionsRef(b.conns),
      })
    })
  }
  return edges.sort((a, b) => a.id.localeCompare(b.id))
}
