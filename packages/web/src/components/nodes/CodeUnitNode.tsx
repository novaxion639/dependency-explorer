import { Handle, Position } from '@xyflow/react'
import type { FlowCodeUnit } from '@dependency-explorer/data'

export const CODE_UNIT_KIND_META: Record<FlowCodeUnit['kind'], { label: string; color: string }> = {
  'controller':     { label: 'CTRL', color: '#3b82f6' },
  'service':        { label: 'SVC',  color: '#6366f1' },
  'manager':        { label: 'MGR',  color: '#8b5cf6' },
  'job':            { label: 'JOB',  color: '#e0761b' },
  'model-callback': { label: 'CB',   color: '#10b981' },
  'component':      { label: 'UI',   color: '#ec4899' },
  'client':         { label: 'HTTP', color: '#06b6d4' },
}

export interface CodeUnitNodeData {
  unit: FlowCodeUnit
  /** GitHub blob link when the owning service has a repoUrl */
  codeUrl?: string
  [key: string]: unknown
}

export function CodeUnitNode({ data }: { data: CodeUnitNodeData }) {
  const { unit, codeUrl } = data
  const meta = CODE_UNIT_KIND_META[unit.kind]

  return (
    <>
      <Handle type="target" position={Position.Left}   id="left"   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <div
        title={unit.description}
        style={{
          width: 230, padding: '7px 10px', borderRadius: 7,
          background: '#161925', border: `1px solid ${meta.color}55`,
          boxShadow: `0 1px 6px #00000040`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
            background: meta.color + '22', color: meta.color, letterSpacing: '0.04em',
            flexShrink: 0,
          }}>
            {meta.label}
          </span>
          <code style={{
            fontSize: 10, color: '#e2e8f0', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {unit.label}
          </code>
        </div>
        {unit.path && (
          codeUrl ? (
            <a
              href={codeUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'block', fontSize: 8, color: '#818cf8', marginTop: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              {unit.path} ↗
            </a>
          ) : (
            <div style={{
              fontSize: 8, color: '#3e4363', marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {unit.path}
            </div>
          )
        )}
        {unit.description && (
          <div style={{
            fontSize: 9, color: '#64748b', marginTop: 3, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {unit.description}
          </div>
        )}
      </div>
    </>
  )
}

/** Container rect drawn behind a service's code units in the code-detail view */
export interface CodeGroupNodeData {
  serviceName: string
  [key: string]: unknown
}

export function CodeGroupNode({ data }: { data: CodeGroupNodeData }) {
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 12,
      background: '#cc342d08', border: '1.5px dashed #cc342d55',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 8, left: 12,
        fontSize: 11, fontWeight: 700, color: '#cc342d',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {data.serviceName}
        <span style={{ fontSize: 9, fontWeight: 600, color: '#cc342d99' }}>— internal code path</span>
      </div>
    </div>
  )
}
