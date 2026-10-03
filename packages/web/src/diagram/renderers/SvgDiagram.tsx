import type { KeyboardEvent, ReactNode } from 'react'
import type { Emphases, Emphasis } from '../focus'
import { edgeSegment, LINE_HEIGHT, PAD_X, PAD_Y, textWidth } from '../geometry'
import type { Box, DiagramModel, DiagramRef } from '../model'
import { edgeName } from '../edgeName'
import { DASH, EMPHASIS_WORD, NODE_DASH, nodeFill, PAINT, strokeWidth } from '../paint'

const LABEL_FONT = 11

interface Props {
  model: DiagramModel
  emphases: Emphases
  onSelect?: (ref: DiagramRef) => void
  standalone?: boolean
}

function Clickable({ label, target, onSelect, children }: { label: string; target?: DiagramRef; onSelect?: (ref: DiagramRef) => void; children: ReactNode }) {
  if (!target || !onSelect) {
    return <g>{children}</g>
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(target)
    }
  }
  return <g role="button" tabIndex={0} aria-label={label} onClick={() => onSelect(target)} onKeyDown={onKey} style={{ cursor: 'pointer' }}>{children}</g>
}

function spoken(label: string, emphasis: Emphasis): string {
  const word = EMPHASIS_WORD[emphasis]
  return word ? `${label} — ${word}` : label
}

function baseline(box: Box, fontSize: number, line: number): number {
  return box.y + PAD_Y + fontSize + line * fontSize * LINE_HEIGHT
}

export function SvgDiagram({ model, emphases, onSelect, standalone = false }: Props) {
  const prefix = model.id.replace(/[^a-z0-9]/gi, '-')
  const boxes = new Map<string, Box & { label: string }>([...model.groups, ...model.nodes].map(b => [b.id, b]))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={model.title}
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={standalone ? model.width : '100%'}
      height={standalone ? model.height : '100%'}
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
      {standalone && <rect width={model.width} height={model.height} style={{ fill: 'var(--paper)' }} />}
      {model.groups.map(g => {
        const emphasis = emphases.groups.get(g.id) ?? 'normal'
        const paint = PAINT[emphasis]
        const fill = emphasis === 'on' ? 'var(--highlight)' : g.kind === 'group' ? 'var(--paper-2)' : 'var(--paper)'
        return (
          <Clickable key={g.id} label={g.label} target={g.ref} onSelect={onSelect}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={6} style={{ fill, stroke: paint.stroke, strokeWidth: 1, strokeDasharray: g.kind === 'lane' ? '4 4' : undefined, opacity: paint.opacity }} />
            <text x={g.x + PAD_X} y={baseline(g, g.fontSize, 0)} style={{ fill: paint.text, fontSize: g.fontSize, fontWeight: 600, opacity: paint.opacity }}>{g.label}</text>
          </Clickable>
        )
      })}
      {model.edges.map(e => {
        const from = boxes.get(e.from)
        const to = boxes.get(e.to)
        if (!from || !to) {
          return null
        }
        const s = edgeSegment(from, to, e.lane, e.lanes)
        const paint = PAINT[emphases.edges.get(e.id) ?? 'normal']
        return (
          <polyline
            key={e.id}
            points={(e.route ?? [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]).map(p => `${p.x},${p.y}`).join(' ')}
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
            <Clickable label={spoken(n.label, emphasis)} target={n.ref} onSelect={onSelect}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} style={{ fill, stroke: paint.stroke, strokeWidth: n.kind === 'subject' ? 2.5 : 1.5, strokeDasharray: NODE_DASH[n.kind], opacity: paint.opacity }} />
              {text.map((line, i) => (
                <text key={`${i}:${line}`} x={n.x + PAD_X} y={baseline(n, n.fontSize, i)} style={{ fill: paint.text, fontSize: n.fontSize, fontWeight: i === 0 ? 600 : 400, opacity: paint.opacity }}>{line}</text>
              ))}
            </Clickable>
            {n.stores.map((store, i) => (
              <Clickable key={store.label} label={`Open ${store.label}`} target={store.resource ? { type: 'resource', id: store.resource } : undefined} onSelect={onSelect}>
                <text x={n.x + PAD_X} y={baseline(n, n.fontSize, text.length + i)} style={{ fill: paint.text, fontSize: n.fontSize, textDecoration: store.resource ? 'underline' : 'none', opacity: paint.opacity }}>{store.label}</text>
              </Clickable>
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
        const segment = edgeSegment(from, to, e.lane, e.lanes)
        const s = e.labelBox ? { lx: e.labelBox.x + e.labelBox.w / 2, ly: e.labelBox.y + 9 } : segment
        const paint = PAINT[emphases.edges.get(e.id) ?? 'normal']
        const pill = e.condition ? `if ${e.condition}` : ''
        const w = Math.max(textWidth(e.label, LABEL_FONT), textWidth(pill, LABEL_FONT)) + 8
        return (
          <Clickable key={`label:${e.id}`} label={edgeName(from.label, to.label, e)} target={e.ref} onSelect={onSelect}>
            {e.label && <rect x={s.lx - w / 2} y={s.ly - 9} width={w} height={16} rx={3} style={{ fill: 'var(--card)', stroke: 'var(--rule)', opacity: paint.opacity }} />}
            {e.label && <text x={s.lx} y={s.ly + 3} textAnchor="middle" style={{ fill: paint.text, fontSize: LABEL_FONT, opacity: paint.opacity }}>{e.label}</text>}
            {pill && <rect x={s.lx - w / 2} y={s.ly + 8} width={w} height={16} rx={8} style={{ fill: 'var(--highlight)', stroke: 'var(--ink)', opacity: paint.opacity }} />}
            {pill && <text x={s.lx} y={s.ly + 20} textAnchor="middle" style={{ fill: 'var(--ink)', fontSize: LABEL_FONT, opacity: paint.opacity }}>{pill}</text>}
          </Clickable>
        )
      })}
    </svg>
  )
}
