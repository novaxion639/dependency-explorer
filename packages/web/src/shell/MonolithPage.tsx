import { useMemo } from 'react'
import { areaFacts, monolithRoutes, resourceSurface } from '@dependency-explorer/data'
import type { UrlState } from '../hooks/useUrlState'
import { MonolithTable } from '../components/monolith/MonolithTable'
import { Diagram } from '../diagram/Diagram'
import type { FocusState } from '../diagram/focus'
import { areaId } from '../diagram/layouts/ids'
import { MONOLITH, monolithRows, monolithTreemap } from '../diagram/layouts/monolith'
import { selectPatch } from '../diagram/refPatch'
import { map } from './dataIndexes'
import { MicroservicesPage } from './MicroservicesPage'
import styles from './MonolithPage.module.css'

interface Props {
  url: UrlState
  patch: (p: Partial<UrlState>) => void
}

const ROWS = monolithRows(map, monolithRoutes, resourceSurface.resources, areaFacts)
const TREEMAP = monolithTreemap(ROWS)
const COVERAGE = areaFacts.coverage[MONOLITH] ?? { mapped: 0, total: 0 }

export function MonolithPage({ url, patch }: Props) {
  const inside = url.s !== MONOLITH
  const spotlight = url.area ? areaId(url.area) : null
  const focus = useMemo<FocusState>(() => ({ spotlight, impact: null }), [spotlight])
  return (
    <div className={styles.page}>
      <div role="group" aria-label="Monolith view" className={styles.switch}>
        <button type="button" aria-pressed={inside} onClick={() => patch({ s: null, drawer: null, ep: null, edge: null })}>Inside · by product area</button>
        <button type="button" aria-pressed={!inside} onClick={() => patch({ s: MONOLITH, area: null })}>Connections</button>
      </div>
      {!inside ? <MicroservicesPage url={url} patch={patch} />
        : url.present ? (
          <Diagram
            model={TREEMAP}
            focus={focus}
            renderer={url.renderer}
            onRenderer={renderer => patch({ renderer })}
            onSelect={ref => {
              const next = selectPatch(ref, url.present)
              if (next) {
                patch(next)
              }
            }}
            filename="monolith"
            notes={['block size = files in skello-app', 'hatched = not mapped to an area yet']}
          />
        ) : (
          <>
            <p className={styles.coverage}>{`${COVERAGE.mapped} of ${COVERAGE.total} skello-app files under the mapped roots belong to a product area.`}</p>
            <MonolithTable rows={ROWS} onOpenArea={id => patch({ area: id })} />
          </>
        )}
    </div>
  )
}
