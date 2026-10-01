import type { KeyboardEvent } from 'react'
import type { ServiceFlow } from '@dependency-explorer/data'
import { buildSequence } from '../../utils/buildSequence'

const COL = 180
const ROW = 44
const HEADER = 56
const PAD = 20
const CHAR_W = 6
const ALT_PREFIX = 'alt '

interface Props {
  flow: ServiceFlow
  onSelectUnit: (id: string) => void
}

export function SequenceDiagram({ flow, onSelectUnit }: Props) {
  const { participants, messages, branches } = buildSequence(flow)
  const unitIds = new Set((flow.codeUnits ?? []).map(u => u.id))
  const x = new Map(participants.map((p, i) => [p.id, PAD + i * COL + COL / 2]))
  const rows: Array<{ kind: 'message'; n: number } | { kind: 'branch'; index: number }> = []
  for (const m of messages) {
    rows.push({ kind: 'message', n: m.n })
    branches.forEach((b, index) => {
      if (b.afterMessage === m.n) {
        rows.push({ kind: 'branch', index })
      }
    })
  }
  const frameWidth = (text: string) => (ALT_PREFIX.length + text.length) * CHAR_W + 16
  const width = Math.max(PAD * 2 + participants.length * COL, ...branches.map(b => frameWidth(b.text) + PAD * 2))
  const height = HEADER + PAD + rows.length * ROW + PAD
  const yOf = (i: number) => HEADER + PAD + i * ROW + ROW / 2

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#0f1117', paddingTop: 44 }}>
      <svg width={width} height={height} role="img" aria-label={`Sequence of ${flow.name}`} style={{ fontFamily: 'inherit' }}>
        <defs>
          <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
        </defs>
        {participants.map(p => {
          const cx = x.get(p.id) ?? 0
          const clickable = unitIds.has(p.id)
          return (
            <g
              key={p.id}
              {...(clickable ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': `Open ${p.label}`,
                onClick: () => onSelectUnit(p.id),
                onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectUnit(p.id)
                  }
                },
              } : {})}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            >
              <rect x={cx - COL / 2 + 8} y={8} width={COL - 16} height={HEADER - 16} rx={6} fill="#1a1d27" stroke="#2e3250" />
              <text x={cx} y={28} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e2e8f0">{p.label.length > 26 ? `${p.label.slice(0, 25)}…` : p.label}</text>
              <text x={cx} y={42} textAnchor="middle" fontSize={9} fill="#64748b">{p.service === p.id ? '' : p.service}</text>
              <title>{`${p.label} — ${p.service}`}</title>
              <line x1={cx} y1={HEADER} x2={cx} y2={height - PAD} stroke="#2e3250" strokeDasharray="3 4" />
            </g>
          )
        })}
        {rows.map((row, i) => {
          const y = yOf(i)
          if (row.kind === 'branch') {
            const b = branches[row.index]
            if (!b) {
              return null
            }
            const w = frameWidth(b.text)
            const x0 = Math.min(Math.max(PAD, (x.get(b.at) ?? 0) - COL / 2 + 4), width - PAD - w)
            return (
              <g key={`b-${row.index}`}>
                <rect x={x0} y={y - ROW / 2 + 6} width={w} height={ROW - 12} rx={5} fill="#ef444418" stroke="#ef444466" />
                <text x={x0 + 8} y={y + 4} fontSize={10} fill="#fca5a5"><tspan fontWeight={700}>{ALT_PREFIX}</tspan>{b.text}</text>
              </g>
            )
          }
          const m = messages[row.n - 1]
          if (!m) {
            return null
          }
          const x1 = x.get(m.from) ?? 0
          const x2 = x.get(m.to) ?? 0
          const crud = m.crud.length ? ` [${m.crud.map(c => c.charAt(0).toUpperCase()).join('')}]` : ''
          return (
            <g key={`m-${m.n}`}>
              <line x1={x1} y1={y} x2={x2 === x1 ? x1 + 30 : x2} y2={y} stroke="#94a3b8" strokeWidth={1.4} strokeDasharray={m.async ? '5 4' : undefined} markerEnd="url(#seq-arrow)" />
              <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#cbd5e1">
                <tspan fontWeight={700} fill="#818cf8">{m.n}. </tspan>{m.label.length > 48 ? `${m.label.slice(0, 47)}…` : m.label}{crud}
                {m.badges.length > 0 && <tspan fill="#a78bfa">{`  ${m.badges.join('  ')}`}</tspan>}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
