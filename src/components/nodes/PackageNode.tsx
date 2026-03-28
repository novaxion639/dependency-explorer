import { Handle, Position } from '@xyflow/react'
import type { PackageCategory } from '../../types'

const CAT_COLOR: Record<PackageCategory, string> = {
  auth: '#f97316',
  infrastructure: '#3b82f6',
  sdk: '#8b5cf6',
  'shared-lib': '#10b981',
  ui: '#ec4899',
  tooling: '#94a3b8',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PackageNode({ data, selected }: any) {
  const { pkg, dimmed, highlighted } = data as {
    pkg: { name: string; category: PackageCategory; usedBy: string[]; sourceRepo: string }
    dimmed: boolean
    highlighted: boolean
  }
  const color = CAT_COLOR[pkg.category]
  const shortName = pkg.name.replace('@skelloapp/', '')
  const opacity = dimmed ? 0.15 : 1

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div
        style={{
          width: 210,
          padding: '6px 10px',
          borderRadius: 7,
          background: selected ? '#1e2347' : '#1a1d27',
          border: `1.5px solid ${selected ? '#6366f1' : highlighted ? color : '#2e3250'}`,
          borderRight: `3px solid ${color}`,
          opacity,
          transition: 'opacity 0.2s, border-color 0.2s',
          cursor: 'pointer',
          boxShadow: selected ? '0 0 0 2px #6366f133' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: color + '22', color,
            padding: '1px 5px', borderRadius: 3, flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {pkg.category}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: highlighted ? '#e2e8f0' : '#a0aec0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {shortName}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
          {pkg.usedBy.length} consumers · {pkg.sourceRepo}
        </div>
      </div>
    </>
  )
}
