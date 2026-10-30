import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { download, exportName, standaloneSvg, svgSize, svgToPng } from './exportImage'
import { emphasise, focusBounds, type FocusState } from './focus'
import type { Point } from './geometry'
import type { DiagramModel, DiagramRef, EdgeMode } from './model'
import { DASH, MODE_LABEL } from './paint'
import { moveNode, NO_PLACEMENT, placed, placedForExport, type Placement } from './placement'
import { ReactFlowDiagram } from './renderers/ReactFlowDiagram'
import { readRootToken } from './tokens'
import styles from './Diagram.module.css'

const MODES: EdgeMode[] = ['sync', 'async', 'data-feed']
const EFFECTS = ['fails', 'starves', 'degrades'] as const

interface Props {
  model: DiagramModel
  focus: FocusState
  onSelect: (ref: DiagramRef) => void
  filename: string
  notes?: string[]
  children?: ReactNode
}

function Legend({ notes, impact }: { notes: string[]; impact: boolean }) {
  return (
    <ul aria-label="Legend" className={styles.legend}>
      {MODES.map(mode => (
        <li key={mode}>
          <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" style={{ stroke: 'var(--ink)', strokeWidth: 2, strokeDasharray: DASH[mode] }} /></svg>
          {MODE_LABEL[mode]}
        </li>
      ))}
      <li>thicker = more connections</li>
      {impact && EFFECTS.map(effect => <li key={effect} data-effect={effect}>{effect}</li>)}
      {notes.map(note => <li key={note}>{note}</li>)}
    </ul>
  )
}

export function Diagram({ model, focus, onSelect, filename, notes = [], children }: Props) {
  const emphases = useMemo(() => emphasise(model, focus), [model, focus])
  const zoomTo = useMemo(() => focusBounds(model, focus.chapter), [model, focus.chapter])
  const frame = useMemo(() => zoomTo ?? { x: 0, y: 0, w: model.width, h: model.height }, [zoomTo, model])
  const [placement, setPlacement] = useState<Placement>(NO_PLACEMENT)
  const display = useMemo(() => placed(model, placement), [model, placement])

  const onMove = useCallback((id: string, position: Point) => {
    setPlacement(prev => moveNode(prev, model.id, id, position))
  }, [model.id])
  const standalone = () => standaloneSvg(placedForExport(model, placement), emphases, readRootToken)
  const exportPng = async () => {
    const svg = standalone()
    download(exportName(filename, 'png'), await svgToPng(svg, svgSize(svg), readRootToken('--paper')))
  }
  const exportSvg = () => {
    download(exportName(filename, 'svg'), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone())}`)
  }

  return (
    <section className={styles.frame} aria-label={model.title}>
      <div role="toolbar" aria-label="Diagram tools" className={styles.toolbar}>
        <button type="button" onClick={() => { void exportPng() }}>Export PNG</button>
        <button type="button" onClick={exportSvg}>Export SVG</button>
        {children}
      </div>
      <div className={styles.canvas}>
        <ReactFlowDiagram key={model.id} model={display} emphases={emphases} frame={frame} focused={zoomTo !== null} onSelect={onSelect} onMove={onMove} />
      </div>
      <Legend notes={notes} impact={focus.impact !== null} />
    </section>
  )
}
