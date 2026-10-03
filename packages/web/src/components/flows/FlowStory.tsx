import type { ReactNode } from 'react'
import type { FlowChapter } from '@dependency-explorer/data'
import styles from './flows.module.css'

interface Props {
  chapters: FlowChapter[]
  authored: boolean
  current: number | null
  onSelect: (chapter: number) => void
  children: ReactNode
}

export function FlowStory({ chapters, authored, current, onSelect, children }: Props) {
  return (
    <div className={styles.story}>
      <div className={styles.chapters}>
        <ol aria-label="Chapters">
          {chapters.map((c, i) => (
            <li key={`${i}:${c.title}`}>
              <button type="button" aria-current={current === i + 1 ? 'step' : undefined} onClick={() => onSelect(i + 1)}>
                <span className={styles.num}>{i + 1}</span>
                <b>{c.title}</b>
                <span className={styles.chapterSummary}>{c.summary}</span>
              </button>
            </li>
          ))}
        </ol>
        {!authored && <p className={styles.note}>Chapters derived from the steps — none authored for this flow yet.</p>}
        <p className={styles.note}>← → step through the chapters</p>
      </div>
      <div className={styles.storyDiagram}>{children}</div>
    </div>
  )
}
