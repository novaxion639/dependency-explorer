import { useState } from 'react'
import type { RefObject } from 'react'
import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react'
import { toPng } from 'html-to-image'

interface Props {
  /** Wrapper around THIS ReactFlow instance — scopes the snapshot when several graphs are mounted (e.g. flow modal over service view) */
  target: RefObject<HTMLDivElement | null>
  /** Base filename, date-stamped and .png-suffixed on click */
  filename: () => string
  /** Offset from the top-right corner of the graph */
  corner?: { top: number; right: number }
}

const MAX_W = 2400
const MAX_H = 1800

/**
 * Renders the FULL graph (not the visible viewport) to a 2× PNG sized to the
 * node bounds, with minimap/controls/overlays stripped. Must live inside the
 * instance's ReactFlowProvider.
 */
export function ExportPngButton({ target, filename, corner = { top: 12, right: 12 } }: Props) {
  const { getNodes } = useReactFlow()
  const [busy, setBusy] = useState(false)

  const exportPng = async () => {
    const viewport = target.current?.querySelector<HTMLElement>('.react-flow__viewport')
    const nodes = getNodes()
    if (!viewport || !nodes.length || busy) return
    setBusy(true)
    try {
      const bounds = getNodesBounds(nodes)
      const scale = Math.min(MAX_W / bounds.width, MAX_H / bounds.height, 1.5)
      const width = Math.max(640, Math.round(bounds.width * scale))
      const height = Math.max(420, Math.round(bounds.height * scale))
      const vp = getViewportForBounds(bounds, width, height, 0.05, 4, 0.07)

      const dataUrl = await toPng(viewport, {
        backgroundColor: '#0f1117',
        width,
        height,
        pixelRatio: 2,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
        filter: el => {
          const cls = (el as HTMLElement).classList
          if (!cls) return true
          return !cls.contains('react-flow__minimap')
            && !cls.contains('react-flow__controls')
            && !cls.contains('react-flow__attribution')
        },
      })

      const a = document.createElement('a')
      a.download = `${filename()}_${new Date().toISOString().slice(0, 10)}.png`
      a.href = dataUrl
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={exportPng}
      title="Export the full graph as a PNG (2× resolution)"
      style={{
        position: 'absolute', top: corner.top, right: corner.right, zIndex: 10,
        padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
        border: '1px solid #2e3250', cursor: busy ? 'wait' : 'pointer',
        background: '#1a1d27', color: busy ? '#3e4363' : '#64748b',
      }}
    >
      {busy ? 'Exporting…' : '⤓ Export PNG'}
    </button>
  )
}
