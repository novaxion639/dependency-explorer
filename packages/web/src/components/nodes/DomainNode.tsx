import { Handle, Position } from '@xyflow/react'

export interface DomainNodeData {
  id: string
  name: string
  description: string
  color: string
  serviceCount: number
  dataEntities?: string[]
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DomainNode({ data }: any) {
  const { name, description, color, serviceCount, dataEntities } = data as DomainNodeData

  return (
    <>
      <Handle type="target" position={Position.Left}   id="left"   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <div style={{
        width: 220,
        padding: '12px 16px',
        borderRadius: 10,
        background: '#1a1d27',
        border: `2px solid ${color}`,
        boxShadow: `0 0 0 4px ${color}18`,
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>
            {name}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8 }}>
          {description}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            background: color + '22', color,
          }}>
            {serviceCount} service{serviceCount !== 1 ? 's' : ''}
          </span>
        </div>
        {dataEntities && dataEntities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
            {dataEntities.map(entity => (
              <span key={entity} style={{
                fontSize: 9, padding: '1px 4px', borderRadius: 3,
                background: '#2e325022', color: '#64748b',
                border: '1px solid #2e3250',
              }}>
                {entity}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
