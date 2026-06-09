import { Handle, Position } from '@xyflow/react'
import type { DatabaseType } from '../../data/schemas'

export const DB_COLORS: Record<DatabaseType, { color: string; label: string; icon: string }> = {
  postgresql:    { color: '#336791', label: 'PostgreSQL',    icon: '🐘' },
  redis:         { color: '#dc382d', label: 'Redis',         icon: '⚡' },
  dynamodb:      { color: '#f59e0b', label: 'DynamoDB',      icon: '◈' },
  mongodb:       { color: '#4db33d', label: 'MongoDB',       icon: '🍃' },
  elasticsearch: { color: '#00bfb3', label: 'Elasticsearch', icon: '🔍' },
  s3:            { color: '#569a31', label: 'S3',            icon: '🗄' },
  sqs:           { color: '#e0761b', label: 'SQS',           icon: '📨' },
  sns:           { color: '#b0631a', label: 'SNS',           icon: '📣' },
  kinesis:       { color: '#9b59b6', label: 'Kinesis',       icon: '🌊' },
  lambda:        { color: '#f97316', label: 'Lambda',        icon: 'λ' },
  cdc:           { color: '#ec4899', label: 'CDC',           icon: '⚡' },
}

const CRUD_STYLE: Record<string, { bg: string; color: string }> = {
  create: { bg: '#10b98122', color: '#10b981' },
  read:   { bg: '#3b82f622', color: '#3b82f6' },
  update: { bg: '#f59e0b22', color: '#f59e0b' },
  delete: { bg: '#ef444422', color: '#ef4444' },
}

export interface DatabaseNodeData {
  dbType: DatabaseType
  name: string
  description: string
  crud?: string[]
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DatabaseNode({ data }: any) {
  const { dbType, name, description, crud } = data as DatabaseNodeData
  const meta = DB_COLORS[dbType as DatabaseType] ?? { color: '#64748b', label: dbType, icon: '💾' }

  return (
    <>
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   id="left"   style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <div style={{
        width: 180,
        padding: '6px 10px',
        borderRadius: 6,
        background: '#0f1117',
        border: `1.5px solid ${meta.color}44`,
        borderTop: `3px solid ${meta.color}`,
        cursor: 'default',
      }}>
        {/* Top row: icon + type badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <span style={{ fontSize: 12 }}>{meta.icon}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: meta.color + '22', color: meta.color, textTransform: 'uppercase',
            letterSpacing: '0.05em', flex: 1,
          }}>
            {meta.label}
          </span>
        </div>
        {/* Name */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        {/* CRUD operations */}
        {crud && crud.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
            {crud.map(op => (
              <span key={op} style={{
                fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                background: CRUD_STYLE[op]?.bg ?? '#64748b22',
                color: CRUD_STYLE[op]?.color ?? '#64748b',
              }}>
                {op}
              </span>
            ))}
          </div>
        )}
        {/* Description */}
        {description && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {description}
          </div>
        )}
      </div>
    </>
  )
}
