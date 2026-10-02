import { useState } from 'react'
import { allResourceRelations, connectivityMap } from '@dependency-explorer/data'
import { computeImpact, type Effect } from '../../utils/impact'

const EFFECT_COLOR: Record<Effect, string> = { fails: '#ef4444', degrades: '#f59e0b', starves: '#818cf8' }

interface Props {
  origin: string
  initialFilter?: 'all' | 'sync'
  onSelect: (node: string) => void
  onOpenFlow: (id: string) => void
  onClose: () => void
}

export function ImpactPanel({ origin, initialFilter = 'all', onSelect, onOpenFlow, onClose }: Props) {
  const [filter, setFilter] = useState(initialFilter)
  const impact = computeImpact(connectivityMap, allResourceRelations, origin)
  const entries = impact.entries.filter(e => filter === 'all' || (e.mode === 'sync' && e.effect === 'fails'))
  const hops = [...new Set(entries.map(e => e.hop))].sort((a, b) => a - b)
  return (
    <aside role="region" aria-label={`Impact of ${origin}`} className="drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)', zIndex: 150, overflowY: 'auto', background: '#13151f', borderLeft: '1px solid #2e3250', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 13, color: '#e2e8f0' }}>If {origin} is down</h2>
        <button type="button" onClick={onClose} aria-label="Close impact" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>×</button>
      </header>
      <div role="group" aria-label="Filter" style={{ display: 'flex', gap: 4, margin: '8px 0' }}>
        {(['all', 'sync'] as const).map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #2e3250', background: filter === f ? '#6366f1' : 'transparent', color: filter === f ? '#fff' : '#94a3b8', cursor: 'pointer' }}>{f === 'all' ? 'All effects' : 'Hard failures (sync)'}</button>
        ))}
      </div>
      {entries.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8' }}>Nothing on the map depends on {origin}.</p>}
      {hops.map(hop => (
        <section key={hop} aria-label={`Hop ${hop}`} style={{ marginTop: 10 }}>
          <h3 style={{ fontSize: 11, color: '#94a3b8' }}>Hop {hop}</h3>
          <ul style={{ listStyle: 'none' }}>
            {entries.filter(e => e.hop === hop).map(e => (
              <li key={e.node} style={{ fontSize: 11, marginTop: 3 }}>
                <button type="button" onClick={() => onSelect(e.node)} style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', padding: 0 }}>{e.node}</button>
                <span style={{ color: EFFECT_COLOR[e.effect], marginLeft: 6 }}>{e.effect === 'fails' && e.hop > 1 ? 'may fail' : e.effect}</span>
                <span style={{ color: '#64748b', marginLeft: 6 }}>via {e.via} ({e.mode})</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {impact.flows.length > 0 && (
        <section aria-label="Affected flows" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 11, color: '#94a3b8' }}>Affected flows</h3>
          <ul style={{ listStyle: 'none' }}>
            {impact.flows.map(f => (
              <li key={f.flowId}>
                <button type="button" onClick={() => onOpenFlow(f.flowId)} style={{ background: 'none', border: 'none', color: '#e0761b', cursor: 'pointer', padding: '2px 0', fontSize: 11, textAlign: 'left' }}>{f.name} — breaks at step {f.step}: {f.from} → {f.to}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
