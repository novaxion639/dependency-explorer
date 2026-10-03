import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { download, exportName, standaloneSvg, svgSize, svgToPng } from './exportImage'
import { emphasise, type FocusState } from './focus'
import type { Point } from './geometry'
import type { DiagramModel, DiagramRef, EdgeMode, Renderer } from './model'
import { DASH, MODE_LABEL } from './paint'
import { MermaidDiagram, renderedSvg, type MermaidRender } from './renderers/MermaidDiagram'
import { moveNode, NO_PLACEMENT, placed, placedForExport, type Placement } from './placement'
import { ReactFlowDiagram } from './renderers/ReactFlowDiagram'
import { SvgDiagram } from './renderers/SvgDiagram'
import { toMermaid } from './renderers/toMermaid'
import { readRootToken } from './tokens'
import styles from './Diagram.module.css'

const RENDERER_LABEL: Record<Renderer, string> = { 'react-flow': 'React Flow', svg: 'SVG', mermaid: 'Mermaid' }
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
  const [placement, setPlacement] = useState<Placement>(NO_PLACEMENT)
  const display = useMemo(() => placed(model, placement), [model, placement])
  const mermaidRender = useRef<MermaidRender | null>(null)
  const [copied, setCopied] = useState(false)
  const source = useMemo(() => (active === 'mermaid' ? toMermaid(model, emphases, readRootToken) : ''), [active, model, emphases])

  const onMove = useCallback((id: string, position: Point) => {
    setPlacement(prev => moveNode(prev, model.id, id, position))
  }, [model.id])
  const onRendered = useCallback((render: MermaidRender) => {
    mermaidRender.current = render
  }, [])
  const standalone = () => standaloneSvg(placedForExport(model, placement), emphases, readRootToken)
  const exportPng = async () => {
    const svg = active === 'mermaid' ? renderedSvg(mermaidRender.current, source) : standalone()
    if (svg) {
      download(exportName(filename, 'png'), await svgToPng(svg, svgSize(svg)))
    }
  }
  const exportSvg = () => {
    download(exportName(filename, 'svg'), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone())}`)
  }
  const copySource = async () => {
    await navigator.clipboard.writeText(source)
    setCopied(true)
  }

  return (
    <section className={styles.frame} aria-label={model.title}>
      <div role="toolbar" aria-label="Diagram tools" className={styles.toolbar}>
        <div role="radiogroup" aria-label="Renderer" className={styles.renderers}>
          {model.renderers.map(r => (
            <button key={r} type="button" role="radio" aria-checked={r === active} onClick={() => onRenderer(r)}>{RENDERER_LABEL[r]}</button>
          ))}
        </div>
        <button type="button" onClick={() => { void exportPng() }}>Export PNG</button>
        {active === 'svg' && <button type="button" onClick={exportSvg}>Export SVG</button>}
        {active === 'mermaid' && <button type="button" onClick={() => { void copySource() }}>{copied ? 'Copied' : 'Copy Mermaid'}</button>}
        {children}
      </div>
      <div className={styles.canvas}>
        {active === 'react-flow' && <ReactFlowDiagram key={model.id} model={display} emphases={emphases} onSelect={onSelect} onMove={onMove} />}
        {active === 'svg' && <SvgDiagram model={display} emphases={emphases} onSelect={onSelect} />}
        {active === 'mermaid' && <MermaidDiagram source={source} onRendered={onRendered} />}
      </div>
      <Legend notes={notes} impact={focus.impact !== null} />
    </section>
  )
}
