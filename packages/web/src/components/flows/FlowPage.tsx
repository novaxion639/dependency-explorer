import { useEffect, useMemo } from 'react'
import type { ServiceFlow } from '@dependency-explorer/data'
import type { UrlState } from '../../hooks/useUrlState'
import { Diagram } from '../../diagram/Diagram'
import type { FocusState } from '../../diagram/focus'
import { chapterFocus, swimlanes } from '../../diagram/layouts/swimlane'
import { selectPatch } from '../../diagram/refPatch'
import { keyInfo, presentStepKey, stepThrough } from '../../shell/presentMode'
import { FlowHeader } from './FlowHeader'
import { FlowStory } from './FlowStory'
import styles from './flows.module.css'

interface Props {
  flow: ServiceFlow
  url: UrlState
  patch: (p: Partial<UrlState>) => void
  onBack: () => void
}

const NOTES = ['if = condition or feature flag', '⎇ = alternative outcome', 'dashed box = background job', '◇ = choice', '⚠ = falls to the error handler', 'solid frame = state machine']

export function FlowPage({ flow, url, patch, onBack }: Props) {
  const model = useMemo(() => swimlanes(flow), [flow])
  const chapters = flow.chapters
  const current = url.chapter ? chapters[url.chapter - 1] : undefined
  const focus = useMemo<FocusState>(
    () => ({ spotlight: null, impact: null, chapter: url.present && current ? chapterFocus(model, flow, current.refs) : null }),
    [url.present, current, model, flow],
  )
  useEffect(() => {
    if (!url.present) {
      return
    }
    const steps = chapters.map((_, i) => String(i + 1))
    const onKey = (e: KeyboardEvent) => {
      const dir = presentStepKey(keyInfo(e))
      if (dir) {
        e.preventDefault()
        const next = stepThrough(steps, url.chapter ? String(url.chapter) : null, dir)
        patch({ chapter: next ? Number(next) : null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url.present, url.chapter, chapters, patch])
  const diagram = (
    <Diagram
      model={model}
      focus={focus}
      renderer={url.renderer}
      onRenderer={renderer => patch({ renderer })}
      onSelect={ref => {
        const next = selectPatch(ref, url.present)
        if (next) {
          patch(next)
        }
      }}
      filename={`flow_${flow.id}`}
      notes={NOTES}
    />
  )
  return (
    <article aria-label={flow.name} className={styles.page}>
      <FlowHeader flow={flow} onBack={onBack} />
      {url.present
        ? <FlowStory chapters={chapters} current={url.chapter} onSelect={chapter => patch({ chapter })}>{diagram}</FlowStory>
        : diagram}
    </article>
  )
}
