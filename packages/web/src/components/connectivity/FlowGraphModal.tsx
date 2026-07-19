import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { ServiceFlow, ConnectivityMap, FlowInfraNode, DomainRule, FlowCodeUnit, RulePlatform } from '@dependency-explorer/data'
import { buildFlowGraph } from '../../utils/buildFlowGraph'
import { buildFlowCodeGraph } from '../../utils/buildFlowCodeGraph'
import { ServiceNode } from '../nodes/ServiceNode'
import { DatabaseNode, DB_COLORS } from '../nodes/DatabaseNode'
import { CodeUnitNode, CodeGroupNode } from '../nodes/CodeUnitNode'
import type { DatabaseType } from '@dependency-explorer/data'
import { ConnectivityEdge } from './ConnectivityEdge'
import { FloatingDbEdge } from './FloatingDbEdge'
import { ExportPngButton } from '../ExportPngButton'

const nodeTypes = { serviceNode: ServiceNode, databaseNode: DatabaseNode, codeUnitNode: CodeUnitNode, codeGroupNode: CodeGroupNode }
const edgeTypes = { connectivityEdge: ConnectivityEdge, floatingDbEdge: FloatingDbEdge }

interface Props {
  flow: ServiceFlow
  map: ConnectivityMap
  /** Code-detail view (?detail=code) — only offered when the flow has a code layer */
  detail: boolean
  onDetailChange: (detail: boolean) => void
  onBack: () => void
  onClose: () => void
}

function FlowInner({ flow, map, detail, onDetailChange, onBack, onClose }: Props) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<ReturnType<typeof buildFlowGraph>['edges'][number]>([])
  const graphRef = useRef<HTMLDivElement>(null)

  const hasCodeLayer = (flow.codeUnits?.length ?? 0) > 0
  const showCode = detail && hasCodeLayer

  // Domain rules referenced by this flow's steps/units → chips + card panel
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const ruleById = useMemo(
    () => new Map((map.rules ?? []).map(r => [r.id, r])),
    [map.rules],
  )
  const unitById = useMemo(
    () => new Map(map.flows.flatMap(f => (f.codeUnits ?? []).map(u => [u.id, u] as const))),
    [map.flows],
  )
  const selectedRule = selectedRuleId ? ruleById.get(selectedRuleId) : undefined

  // Flags gating parts of this flow — aggregated over code units and edges
  const flowFlags = useMemo(() => {
    const byName = new Map<string, { kind: string; gates: string[] }>()
    for (const u of flow.codeUnits ?? []) {
      for (const f of u.flags ?? []) {
        const e = byName.get(f.name) ?? { kind: f.kind, gates: [] }
        e.gates.push(u.label)
        byName.set(f.name, e)
      }
    }
    for (const edge of flow.codeEdges ?? []) {
      for (const f of edge.flags ?? []) {
        const e = byName.get(f.name) ?? { kind: f.kind, gates: [] }
        e.gates.push(edge.label ?? `${edge.from} → ${edge.to}`)
        byName.set(f.name, e)
      }
    }
    return [...byName.entries()]
  }, [flow])

  useEffect(() => {
    const { nodes: n, edges: e } = showCode ? buildFlowCodeGraph(flow, map) : buildFlowGraph(flow, map)
    setNodes(n)
    setEdges(e)
    setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60)
  }, [flow, map, showCode, setNodes, setEdges, fitView])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  return (
    <div
      onKeyDown={onKeyDown}
      tabIndex={-1}
      style={{ outline: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Toolbar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #2e3250',
        background: '#242736',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        {/* Top row: back + title + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid #2e3250', color: '#94a3b8',
              borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}
          >
            ← Back
          </button>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>
            {flow.name}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Description — full text, no truncation */}
        {flow.description && (
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            {flow.description}
          </div>
        )}

        {/* Feature flags gating parts of this flow */}
        {flowFlags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {flowFlags.map(([name, meta]) => (
              <span
                key={name}
                title={`${meta.kind} flag — gates: ${meta.gates.join(' · ')}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: '#a78bfa16', border: '1px solid #a78bfa33',
                  color: '#a78bfa', fontWeight: 600,
                }}
              >
                <span>🚩</span>
                <code>{name}</code>
              </span>
            ))}
          </div>
        )}

        {/* Infra legend — deduplicated by label + type */}
        {(flow.infraNodes ?? []).length > 0 && (() => {
          const seen = new Map<string, { infra: FlowInfraNode; cruds: Set<string> }>()
          for (const infra of flow.infraNodes ?? []) {
            const key = `${infra.type}:${infra.label}`
            const existing = seen.get(key)
            if (existing) {
              for (const e of flow.infraEdges ?? []) {
                if (e.to === infra.id && e.crud?.length) e.crud.forEach(c => existing.cruds.add(c))
              }
            } else {
              const cruds = new Set<string>()
              for (const e of flow.infraEdges ?? []) {
                if (e.to === infra.id && e.crud?.length) e.crud.forEach(c => cruds.add(c))
              }
              seen.set(key, { infra, cruds })
            }
          }
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[...seen.values()].map(({ infra, cruds }) => {
                const meta = DB_COLORS[infra.type as DatabaseType] ?? { color: '#64748b', icon: '💾', label: infra.type }
                const crudLabel = cruds.size ? [...cruds].map(c => c[0]!.toUpperCase()).join('') : ''
                return (
                  <span
                    key={infra.id}
                    title={infra.description}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: meta.color + '16', border: `1px solid ${meta.color}33`,
                      color: meta.color,
                    }}
                  >
                    <span>{meta.icon}</span>
                    <span style={{ fontWeight: 600 }}>{meta.label}</span>
                    {crudLabel && <span style={{ fontWeight: 700, fontSize: 9, opacity: 0.8 }}>[{crudLabel}]</span>}
                  </span>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Flow graph */}
      <div ref={graphRef} style={{ flex: 1, position: 'relative' }}>
        <ExportPngButton target={graphRef} filename={() => `flow_${flow.id}${showCode ? '_code' : ''}`} />
        {hasCodeLayer && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            display: 'flex', gap: 2, background: '#1a1d27',
            border: '1px solid #2e3250', borderRadius: 6, padding: 2,
          }}>
            {([['Services', false], ['Code detail', true]] as const).map(([label, value]) => (
              <button
                key={label}
                onClick={() => onDetailChange(value)}
                style={{
                  padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: showCode === value ? '#6366f1' : 'transparent',
                  color: showCode === value ? '#fff' : '#64748b',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.05}
          maxZoom={2}
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2235" />
          <Controls style={{ background: '#1a1d27', border: '1px solid #2e3250', borderRadius: 8 }} />
          <MiniMap
            style={{ background: '#0f1117', border: '1px solid #2e3250' }}
            nodeColor={node => {
              if (node.type === 'databaseNode') {
                const dbType = (node.data as { dbType?: DatabaseType }).dbType
                return dbType ? (DB_COLORS[dbType]?.color ?? '#64748b') : '#64748b'
              }
              const type = (node.data as { type?: string }).type ?? ''
              if (type === 'vue-frontend')  return '#42b883'
              if (type === 'rails-monolith') return '#cc342d'
              return '#6366f1'
            }}
            maskColor="#0f111799"
          />
        </ReactFlow>

        {/* Step legend */}
        <StepLegend flow={flow} ruleById={ruleById} onRuleClick={setSelectedRuleId} />

        {/* Rule card */}
        {selectedRule && (
          <RuleCard rule={selectedRule} unitById={unitById} onClose={() => setSelectedRuleId(null)} />
        )}
      </div>
    </div>
  )
}

const RULE_PLATFORM_COLORS: Record<RulePlatform, string> = {
  backend: '#f59e0b',
  monolith: '#cc342d',
  web: '#42b883',
  mobile: '#ec4899',
  tablet: '#06b6d4',
}

function RuleChip({ rule, onClick }: { rule: DomainRule; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(rule.id)}
      title={rule.title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
        background: '#a78bfa16', border: '1px solid #a78bfa44', color: '#a78bfa',
        fontWeight: 600,
      }}
    >
      <span>📐</span>
      <span>{rule.title}</span>
    </button>
  )
}

function RuleCard({ rule, unitById, onClose }: {
  rule: DomainRule
  unitById: Map<string, FlowCodeUnit>
  onClose: () => void
}) {
  const sourceUnit = rule.sourceOfTruth ? unitById.get(rule.sourceOfTruth) : undefined
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, bottom: 12, width: 420, zIndex: 20,
      background: '#1a1d27f2', border: '1px solid #a78bfa44', borderRadius: 10,
      padding: '14px 16px', overflowY: 'auto', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>📐</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>{rule.title}</div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.55 }}>{rule.statement}</div>

      {sourceUnit && (
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          <span style={{ fontWeight: 700, color: '#a78bfa' }}>Source of truth: </span>
          {sourceUnit.label} <span style={{ color: '#64748b' }}>({sourceUnit.service}{sourceUnit.path ? ` — ${sourceUnit.path}` : ''})</span>
        </div>
      )}

      {(rule.divergences ?? []).length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Platform divergences
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(rule.divergences ?? []).map((div, i) => {
              const color = RULE_PLATFORM_COLORS[div.platform]
              const unit = div.codeUnitRef ? unitById.get(div.codeUnitRef) : undefined
              return (
                <div key={i} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {div.platform}
                  </span>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5, marginTop: 2 }}>{div.behavior}</div>
                  {unit && (
                    <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                      ↳ {unit.label} <span style={{ opacity: 0.7 }}>({unit.service}{unit.path ? ` — ${unit.path}` : ''})</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#3e4363', marginTop: 'auto' }}>
        Sources: {rule.sourcePaths.join(' · ')}
      </div>
    </div>
  )
}

function StepLegend({ flow, ruleById, onRuleClick }: {
  flow: ServiceFlow
  ruleById: Map<string, DomainRule>
  onRuleClick: (id: string) => void
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      left: 10,
      background: '#1a1d27cc',
      border: '1px solid #2e3250',
      borderRadius: 8,
      padding: '8px 12px',
      maxWidth: 280,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Steps
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {flow.steps.map((step, i) => (
          <div key={i}>
            {step.phase && step.phase !== flow.steps[i - 1]?.phase && (
              <div style={{
                fontSize: 8, fontWeight: 700, color: '#e0761b', textTransform: 'uppercase',
                letterSpacing: '0.05em', margin: '5px 0 3px',
              }}>
                ▸ {step.phase}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#6366f1',
                background: '#6366f122', border: '1px solid #6366f133',
                borderRadius: 3, padding: '0px 4px', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                <span style={{ color: '#818cf8' }}>{step.from}</span>
                {' → '}
                <span style={{ color: '#4f6ef7' }}>{step.to}</span>
              </span>
              {(step.ruleRefs ?? []).map(ref => {
                const rule = ruleById.get(ref)
                return rule ? <RuleChip key={ref} rule={rule} onClick={onRuleClick} /> : null
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FlowGraphModal(props: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={props.onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal container */}
      <div
        style={{
          position: 'fixed',
          top: '4vh', left: '4vw',
          width: '92vw', height: '92vh',
          zIndex: 201,
          background: '#13151f',
          border: '1px solid #2e3250',
          borderRadius: 14,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <ReactFlowProvider>
          <FlowInner {...props} />
        </ReactFlowProvider>
      </div>
    </>
  )
}
