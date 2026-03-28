import { Handle, Position } from '@xyflow/react'
import type { RepoType } from '../../types'

const TYPE_COLOR: Record<RepoType, string> = {
  'rails-monolith': '#cc342d',
  'rails-microservice': '#e05c57',
  'typescript-microservice': '#3178c6',
  'vue-frontend': '#42b883',
  'react-native': '#61dafb',
  'npm-package': '#a78bfa',
  monorepo: '#f59e0b',
  other: '#64748b',
}

const TYPE_ICON: Record<RepoType, string> = {
  'rails-monolith': '💎',
  'rails-microservice': '💎',
  'typescript-microservice': 'TS',
  'vue-frontend': 'V',
  'react-native': '⚛',
  'npm-package': '📦',
  monorepo: '🗂',
  other: '·',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RepoNode({ data, selected }: any) {
  const { repo, dimmed, highlighted } = data as {
    repo: { name: string; type: RepoType; internalDependencies: string[] }
    dimmed: boolean
    highlighted: boolean
  }
  const color = TYPE_COLOR[repo.type]
  const opacity = dimmed ? 0.15 : 1

  return (
    <>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        style={{
          width: 180,
          padding: '6px 10px',
          borderRadius: 7,
          background: selected ? '#1e2347' : '#1a1d27',
          border: `1.5px solid ${selected ? '#6366f1' : highlighted ? color : '#2e3250'}`,
          borderLeft: `3px solid ${color}`,
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
          }}>
            {TYPE_ICON[repo.type]}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#e2e8f0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {repo.name}
          </span>
        </div>
        {repo.internalDependencies.length > 0 && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            {repo.internalDependencies.length} deps
          </div>
        )}
      </div>
    </>
  )
}
