import type { ServiceFlow, ConnectivityMap, FlowCodeUnit, FlowCodeEdge, DomainRule } from '@dependency-explorer/data'
import { CODE_UNIT_KIND_META } from '../nodes/CodeUnitNode'
import { EdgeBadges } from './EdgeBadges'

// Click-to-open detail for a code unit in the code-detail view — the full
// story of one node: unclamped description, source link, the rules it
// implements, its flags, every call edge it participates in with the edge's
// expressiveness annotations, and the other flows crossing the same file.
interface Props {
  unit: FlowCodeUnit
  flow: ServiceFlow
  map: ConnectivityMap
  onOpenRule: (ruleId: string) => void
  onOpenFlow: (flowId: string) => void
  onClose: () => void
}

const MODE_LABEL: Record<string, string> = {
  'sync': 'sync', 'async-job': 'async · job', 'async-event': 'async · event',
}

function EdgeRow({ edge, direction, otherLabel }: { edge: FlowCodeEdge; direction: 'in' | 'out'; otherLabel: string }) {
  return (
    <div style={{ borderLeft: `2px solid ${direction === 'out' ? '#6366f1' : '#3e4363'}`, paddingLeft: 8 }}>
      <div style={{ fontSize: 10.5, color: '#cbd5e1', display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ color: '#64748b' }}>{direction === 'out' ? '→' : '←'}</span>
        <span style={{ fontWeight: 650 }}>{otherLabel}</span>
        <span style={{
          fontSize: 8.5, fontWeight: 700, padding: '0 4px', borderRadius: 3,
          background: '#2e3250', color: '#94a3b8',
        }}>
          {MODE_LABEL[edge.mode ?? 'sync']}
        </span>
        {edge.inTransaction && <span style={{ fontSize: 9, color: '#e0761b' }}>⟳ in transaction</span>}
        {edge.crud?.length ? <span style={{ fontSize: 9, color: '#64748b' }}>[{edge.crud.map(c => c[0]!.toUpperCase()).join('')}]</span> : null}
      </div>
      {edge.label && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{edge.label}</div>}
      {edge.condition && <div style={{ fontSize: 9.5, color: '#e0761b', marginTop: 1 }}>⚑ {edge.condition}</div>}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
        <EdgeBadges data={{ failure: edge.failure, auth: edge.auth, pii: edge.pii, contractRefs: edge.contractRefs }} />
      </div>
    </div>
  )
}

export function CodeUnitDetailPanel({ unit, flow, map, onOpenRule, onOpenFlow, onClose }: Props) {
  const meta = CODE_UNIT_KIND_META[unit.kind]
  const svc = map.services.find(s => s.name === unit.service)
  const codeUrl = svc?.repoUrl && unit.path ? `${svc.repoUrl}/blob/master/${unit.path}` : undefined
  const unitById = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
  const endpointLabel = (id: string) => unitById.get(id)?.label
    ?? (flow.infraNodes ?? []).find(n => n.id === id)?.label
    ?? id
  const outgoing = (flow.codeEdges ?? []).filter(e => e.from === unit.id)
  const incoming = (flow.codeEdges ?? []).filter(e => e.to === unit.id)
  const ruleById = new Map((map.rules ?? []).map(r => [r.id, r]))
  const rules = (unit.ruleRefs ?? []).map(id => ruleById.get(id)).filter((r): r is DomainRule => !!r)
  const otherFlows = unit.path
    ? map.flows.filter(f => f.id !== flow.id
        && (f.codeUnits ?? []).some(u => u.service === unit.service && u.path === unit.path))
    : []

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, bottom: 12, width: 430, zIndex: 20,
      background: '#1a1d27f2', border: `1px solid ${meta.color}55`, borderRadius: 10,
      padding: '14px 16px', overflowY: 'auto', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
          background: meta.color + '22', color: meta.color, letterSpacing: '0.04em', flexShrink: 0,
        }}>
          {meta.label}
        </span>
        <code style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 650, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
          {unit.label}
        </code>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
        <span style={{ color: '#818cf8' }}>{unit.service}</span>
        {unit.path && (
          <>
            {' · '}
            {codeUrl
              ? <a href={codeUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>{unit.path} ↗</a>
              : <code style={{ fontSize: 10 }}>{unit.path}</code>}
          </>
        )}
      </div>

      {unit.description && (
        <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.55 }}>{unit.description}</div>
      )}

      {(unit.flags ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(unit.flags ?? []).map(f => (
            <span key={f.name} style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
              background: '#a78bfa22', color: '#a78bfa',
            }}>
              🚩 {f.name} · {f.kind}
            </span>
          ))}
        </div>
      )}

      {rules.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Domain rules
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {rules.map(r => (
              <button
                key={r.id}
                onClick={() => onOpenRule(r.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                  fontSize: 10, padding: '2px 7px', borderRadius: 4,
                  background: '#a78bfa16', border: '1px solid #a78bfa44', color: '#a78bfa', fontWeight: 600,
                }}
              >
                📐 {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Call edges ({incoming.length} in · {outgoing.length} out)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incoming.map((e, i) => <EdgeRow key={`in-${i}`} edge={e} direction="in" otherLabel={endpointLabel(e.from)} />)}
            {outgoing.map((e, i) => <EdgeRow key={`out-${i}`} edge={e} direction="out" otherLabel={endpointLabel(e.to)} />)}
          </div>
        </div>
      )}

      {otherFlows.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Same file in other flows
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {otherFlows.map(f => (
              <button
                key={f.id}
                onClick={() => onOpenFlow(f.id)}
                style={{
                  cursor: 'pointer', fontSize: 10, padding: '2px 7px', borderRadius: 4,
                  background: '#4f6ef716', border: '1px solid #4f6ef744', color: '#4f6ef7', fontWeight: 600,
                }}
              >
                {f.name} →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
