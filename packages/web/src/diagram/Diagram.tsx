import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { download, exportName, standaloneSvg, svgSize, svgToPng } from './exportImage'
import { CopyMermaid } from './CopyMermaid'
import { emphasise, focusBounds, type FocusState } from './focus'
import type { Point } from './geometry'
import type { DiagramModel, DiagramRef, EdgeMode, Renderer } from './model'
import { DASH, MODE_LABEL } from './paint'
import { moveNode, NO_PLACEMENT, placed, placedForExport, type Placement } from './placement'
import { ReactFlowDiagram } from './renderers/ReactFlowDiagram'
import { SvgDiagram } from './renderers/SvgDiagram'
import { toMermaid } from './renderers/toMermaid'
import { readRootToken } from './tokens'
import styles from './Diagram.module.css'
import { SkButton, SkSegmentedButton, SkSegmentedButtonItem } from '@skelloapp/skello-ds-web'

const RENDERER_LABEL: Record<Renderer, string> = { 'react-flow': 'React Flow', svg: 'SVG' }
const MODES: EdgeMode[] = ['sync', 'async', 'data-feed']
const EFFECTS = ['fails', 'starves', 'degrades'] as const

interface Props {
  model: DiagramModel
  focus: FocusState
  renderer: Renderer
  onRenderer: (renderer: Renderer) => void
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

export function Diagram({ model, focus, renderer, onRenderer, onSelect, filename, notes = [], children }: Props) {
  const active: Renderer = model.renderers.includes(renderer) ? renderer : 'react-flow'
  const emphases = useMemo(() => emphasise(model, focus), [model, focus])
  const zoomTo = useMemo(() => focusBounds(model, focus.chapter), [model, focus.chapter])
  const frame = useMemo(() => zoomTo ?? { x: 0, y: 0, w: model.width, h: model.height }, [zoomTo, model])
  const [placement, setPlacement] = useState<Placement>(NO_PLACEMENT)
  const display = useMemo(() => placed(model, placement), [model, placement])
  const source = useMemo(() => toMermaid(model, emphases, readRootToken), [model, emphases])

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
        <SkSegmentedButton aria-label="Renderer" value={active} onChange={(_, renderer) => onRenderer(renderer)}>
          {model.renderers.map(r => <SkSegmentedButtonItem key={r} value={r}>{RENDERER_LABEL[r]}</SkSegmentedButtonItem>)}
        </SkSegmentedButton>
        <SkButton variant="outlined" size="small" onClick={() => { void exportPng() }}>Export PNG</SkButton>
        {active === 'svg' && <SkButton variant="outlined" size="small" onClick={exportSvg}>Export SVG</SkButton>}
        <CopyMermaid source={source} />
        {children}
      </div>
      <div className={styles.canvas}>
        {active === 'react-flow' && <ReactFlowDiagram key={model.id} model={display} emphases={emphases} frame={frame} focused={zoomTo !== null} onSelect={onSelect} onMove={onMove} />}
        {active === 'svg' && <SvgDiagram model={display} emphases={emphases} zoomTo={zoomTo} onSelect={onSelect} />}
      </div>
      <Legend notes={notes} impact={focus.impact !== null} />
    </section>
  )
}
