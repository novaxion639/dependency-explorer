import { useState } from 'react'
import type { ServiceEndpoint, HttpMethod } from '../../data/schemas'
import { DB_COLORS } from '../nodes/DatabaseNode'

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
}

const PARAM_IN_COLOR: Record<string, string> = {
  path: '#f59e0b',
  query: '#10b981',
  body: '#8b5cf6',
  header: '#64748b',
}

interface Props {
  serviceName: string
  endpoints: ServiceEndpoint[]
  onClose: () => void
}

export function EndpointDrawer({ serviceName, endpoints, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(endpoints[0]?.id ?? null)

  const toggle = (id: string) => setOpen(prev => (prev === id ? null : id))

  return (
    <div style={{
      width: 400, borderLeft: '1px solid #2e3250', background: '#1a1d27',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid #2e3250', background: '#242736',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>{serviceName}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      {/* Accordion list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {endpoints.map(ep => {
          const isOpen = open === ep.id
          const color = METHOD_COLOR[ep.method]

          return (
            <div key={ep.id} style={{ borderBottom: '1px solid #1e2235' }}>
              {/* Accordion header */}
              <button
                onClick={() => toggle(ep.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, width: 48, textAlign: 'center',
                  padding: '2px 0', borderRadius: 3, flexShrink: 0,
                  background: color + '22', color,
                }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{ep.path}</code>
                <span style={{ color: '#3e4363', fontSize: 14, flexShrink: 0 }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <div style={{ padding: '0 16px 14px 16px' }}>
                  {/* AWS calls */}
                  {ep.awsCalls && ep.awsCalls.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <Label>AWS resources</Label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {ep.awsCalls.map((c, i) => {
                          const meta = DB_COLORS[c.type] ?? { color: '#64748b', icon: '💾', label: c.type }
                          return (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, padding: '2px 7px', borderRadius: 4,
                              background: meta.color + '18', border: `1px solid ${meta.color}44`,
                              color: meta.color,
                            }}>
                              {meta.icon} <span style={{ fontWeight: 600 }}>{meta.label}</span>
                              <span style={{ color: meta.color + 'aa', fontSize: 10 }}>{c.name}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div style={{ marginBottom: 10 }}>
                    <Label>Description</Label>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>{ep.description}</p>
                  </div>

                  {/* Use case */}
                  <div style={{ marginBottom: 10 }}>
                    <Label>Use case</Label>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>{ep.useCase}</p>
                  </div>

                  {/* Params */}
                  {ep.params.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <Label>Parameters</Label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {ep.params.map(p => (
                          <div key={p.name} style={{
                            background: '#0f1117', borderRadius: 6, padding: '6px 10px',
                            border: '1px solid #2e3250',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <code style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{p.name}</code>
                              <span style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                                background: (PARAM_IN_COLOR[p.in] ?? '#64748b') + '22',
                                color: PARAM_IN_COLOR[p.in] ?? '#64748b',
                              }}>{p.in}</span>
                              <span style={{ fontSize: 10, color: '#64748b' }}>{p.type}</span>
                              {p.required && (
                                <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>required</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response */}
                  <div>
                    <Label>Response</Label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {Object.entries(ep.response).map(([code, desc]) => (
                        <div key={code} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <code style={{
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                            color: code.startsWith('2') ? '#10b981' : code.startsWith('4') ? '#f59e0b' : '#ef4444',
                          }}>
                            {code}
                          </code>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#3e4363', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
      {children}
    </div>
  )
}
