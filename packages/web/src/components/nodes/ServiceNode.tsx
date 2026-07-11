import { Handle, Position } from '@xyflow/react'
import type { ServiceNodeData } from '../../utils/buildConnectivityGraph'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ServiceNode({ data }: any) {
  const { name, description, type, isSelected, isCaller, isCallee, teamName, recurringTasks } = data as ServiceNodeData

  const isVue = type === 'vue-frontend'
  const isRails = type === 'rails-monolith'
  const accentColor = isVue ? '#42b883' : isRails ? '#cc342d' : null

  const borderColor = isSelected
    ? (accentColor ?? '#6366f1')
    : isCaller && isCallee
      ? '#f59e0b'
      : isCaller
        ? '#818cf8'
        : isCallee
          ? (accentColor ?? '#4f6ef7')
          : '#2e3250'

  const bg = isSelected ? '#1e2347' : '#1a1d27'
  const label = isCaller && isCallee ? 'caller + callee' : isCaller ? 'caller' : isCallee ? 'callee' : ''
  const labelColor = isCaller && isCallee ? '#f59e0b' : isCaller ? '#818cf8' : '#4f6ef7'

  return (
    <>
      <Handle type="target" position={Position.Left}   id="left"   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <div
        style={{
          width: 200,
          padding: '8px 12px',
          borderRadius: 8,
          background: bg,
          border: `1.5px solid ${borderColor}`,
          boxShadow: isSelected ? `0 0 0 3px ${borderColor}33` : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {recurringTasks && recurringTasks.length > 0 && (
            <span
              title={recurringTasks.map(t => `${t.name} — ${t.schedule}`).join('\n')}
              style={{ fontSize: 10, flexShrink: 0, cursor: 'help' }}
            >
              ⏰
            </span>
          )}
          {label && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: labelColor + '22', color: labelColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {label}
            </span>
          )}
        </div>
        {teamName && (
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{teamName}</div>
        )}
        {description && (
          <div style={{
            fontSize: 10, color: '#94a3b8', marginTop: 4,
            lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'break-word',
          }}>
            {description}
          </div>
        )}
      </div>
    </>
  )
}
