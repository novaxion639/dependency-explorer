import { useEffect, useState } from 'react'
import { renderMermaid } from './mermaidRuntime'
import styles from './MermaidDiagram.module.css'

interface Rendered { source: string; svg?: string; error?: string }

export function MermaidDiagram({ source, onRendered }: { source: string; onRendered: (svg: string) => void }) {
  const [rendered, setRendered] = useState<Rendered | null>(null)
  useEffect(() => {
    let live = true
    renderMermaid(source).then(
      svg => {
        if (live) {
          setRendered({ source, svg })
          onRendered(svg)
        }
      },
      (error: unknown) => {
        if (live) {
          setRendered({ source, error: String(error) })
        }
      },
    )
    return () => {
      live = false
    }
  }, [source, onRendered])
  const current = rendered?.source === source ? rendered : null
  if (current?.error) {
    return <p role="alert" className={styles.message}>Mermaid could not draw this view: {current.error}</p>
  }
  if (!current?.svg) {
    return <p className={styles.message}>Rendering…</p>
  }
  return <div className={styles.mermaid} role="img" aria-label="Mermaid diagram" dangerouslySetInnerHTML={{ __html: current.svg }} />
}
