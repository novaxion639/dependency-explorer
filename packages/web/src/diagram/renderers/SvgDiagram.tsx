import type { Emphases } from '../focus'
import { EDGE_LABEL_FONT, EDGE_LABEL_LINE, edgeSegment, LINE_HEIGHT, PAD_X, PAD_Y, segmentPoints, textWidth } from '../geometry'
import type { Box, DiagramModel, GroupKind } from '../model'
import { DASH, NODE_DASH, nodeFill, PAINT, strokeWidth } from '../paint'

const GROUP_DASH: Partial<Record<GroupKind, string>> = { lane: '4 4', frame: '3 3' }
function baseline(box: Box, fontSize: number, line: number): number {
  return box.y + PAD_Y + fontSize + line * fontSize * LINE_HEIGHT
}

export function SvgDiagram({ model, emphases }: { model: DiagramModel; emphases: Emphases }) {
  const prefix = model.id.replace(/[^a-z0-9]/gi, '-')
  const boxes = new Map<string, Box & { label: string }>([...model.groups, ...model.nodes].map(b => [b.id, b]))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={model.title}
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={model.width}
      height={model.height}
      style={{ fontFamily: 'var(--font-sans)', background: 'var(--paper)' }}
    >
      <defs>
        <marker id={`${prefix}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--ink)' }} />
        </marker>
        <pattern id={`${prefix}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" style={{ fill: 'var(--paper)' }} />
          <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: 'var(--rule-strong)', strokeWidth: 3 }} />
        </pattern>
      </defs>
      <rect width={model.width} height={model.height} style={{ fill: 'var(--paper)' }} />
      {model.groups.map(g => {
        const emphasis = emphases.groups.get(g.id) ?? 'normal'
        const paint = PAINT[emphasis]
        const fill = emphasis === 'on' ? 'var(--highlight)' : g.kind === 'group' ? 'var(--paper-2)' : g.kind === 'frame' ? 'none' : 'var(--paper)'
        return (
          <g key={g.id}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={6} style={{ fill, stroke: paint.stroke, strokeWidth: g.kind === 'machine' ? 1.5 : 1, strokeDasharray: GROUP_DASH[g.kind], opacity: paint.opacity }} />
            <text x={g.x + PAD_X} y={baseline(g, g.fontSize, 0)} style={{ fill: paint.text, fontSize: g.fontSize, fontWeight: 600, opacity: paint.opacity }}>{g.label}</text>
          </g>
        )
      })}
      {model.edges.map(e => {
        const from = boxes.get(e.from)
        const to = boxes.get(e.to)
        if (!from || !to) {
          return null
        }
        const paint = PAINT[emphases.edges.get(e.id) ?? 'normal']
        return (
          <polyline
            key={e.id}
            points={(e.route ?? segmentPoints(edgeSegment(from, to, e.lane, e.lanes))).map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            markerEnd={e.directed ? `url(#${prefix}-arrow)` : undefined}
            style={{ stroke: paint.stroke, strokeWidth: strokeWidth(e.weight), strokeDasharray: DASH[e.mode], opacity: paint.opacity }}
          />
        )
      })}
      {model.nodes.map(n => {
        const emphasis = emphases.nodes.get(n.id) ?? 'normal'
        const paint = PAINT[emphasis]
        const fill = nodeFill(n.kind, emphasis) ?? `url(#${prefix}-hatch)`
        const text = [n.label, ...n.detail].filter(Boolean)
        return (
          <g key={n.id}>
            <g>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} style={{ fill, stroke: paint.stroke, strokeWidth: n.kind === 'subject' ? 2.5 : 1.5, strokeDasharray: NODE_DASH[n.kind], opacity: paint.opacity }} />
              {text.map((line, i) => (
                <text key={`${i}:${line}`} x={n.x + PAD_X} y={baseline(n, n.fontSize, i)} style={{ fill: paint.text, fontSize: n.fontSize, fontWeight: i === 0 ? 600 : 400, opacity: paint.opacity }}>{line}</text>
              ))}
            </g>
            {n.stores.map((store, i) => (
              <g key={store.label}>
                <text x={n.x + PAD_X} y={baseline(n, n.fontSize, text.length + i)} style={{ fill: paint.text, fontSize: n.fontSize, textDecoration: store.resource ? 'underline' : 'none', opacity: paint.opacity }}>{store.label}</text>
              </g>
            ))}
          </g>
        )
      })}
      {model.edges.map(e => {
        const from = boxes.get(e.from)
        const to = boxes.get(e.to)
        if (!from || !to || (!e.label && !e.condition)) {
          return null
        }
        if (e.labelBox && e.labelLines) {
          const box = e.labelBox
          const paint = PAINT[emphases.edges.get(e.id) ?? 'normal']
          const label = e.labelLines
          const pill = e.conditionLines ?? []
          const pillY = box.y + label.length * EDGE_LABEL_LINE
          return (
            <g key={`label:${e.id}`}>
              {label.length > 0 && <rect x={box.x} y={box.y} width={box.w} height={label.length * EDGE_LABEL_LINE} rx={3} style={{ fill: 'var(--card)', stroke: 'var(--rule)', opacity: paint.opacity }} />}
              {label.map((line, i) => <text key={`l${i}:${line}`} x={box.x + box.w / 2} y={box.y + 12 + i * EDGE_LABEL_LINE} textAnchor="middle" style={{ fill: paint.text, fontSize: EDGE_LABEL_FONT, opacity: paint.opacity }}>{line}</text>)}
              {pill.length > 0 && <rect x={box.x} y={pillY} width={box.w} height={pill.length * EDGE_LABEL_LINE} rx={8} style={{ fill: 'var(--highlight)', stroke: 'var(--ink)', opacity: paint.opacity }} />}
              {pill.map((line, i) => <text key={`p${i}:${line}`} x={box.x + box.w / 2} y={pillY + 12 + i * EDGE_LABEL_LINE} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: EDGE_LABEL_FONT, opacity: paint.opacity }}>{line}</text>)}
            </g>
          )
        }
        const s = e.labelBox ? { lx: e.labelBox.x + e.labelBox.w / 2, ly: e.labelBox.y + 9 } : edgeSegment(from, to, e.lane, e.lanes)
        const paint = PAINT[emphases.edges.get(e.id) ?? 'normal']
        const pill = e.condition ? `if ${e.condition}` : ''
        const w = Math.max(textWidth(e.label, EDGE_LABEL_FONT), textWidth(pill, EDGE_LABEL_FONT)) + 8
        return (
          <g key={`label:${e.id}`}>
            {e.label && <rect x={s.lx - w / 2} y={s.ly - 9} width={w} height={16} rx={3} style={{ fill: 'var(--card)', stroke: 'var(--rule)', opacity: paint.opacity }} />}
            {e.label && <text x={s.lx} y={s.ly + 3} textAnchor="middle" style={{ fill: paint.text, fontSize: EDGE_LABEL_FONT, opacity: paint.opacity }}>{e.label}</text>}
            {pill && <rect x={s.lx - w / 2} y={s.ly + 8} width={w} height={16} rx={8} style={{ fill: 'var(--highlight)', stroke: 'var(--ink)', opacity: paint.opacity }} />}
            {pill && <text x={s.lx} y={s.ly + 20} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: EDGE_LABEL_FONT, opacity: paint.opacity }}>{pill}</text>}
          </g>
        )
      })}
    </svg>
  )
}
