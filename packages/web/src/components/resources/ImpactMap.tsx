import { useMemo } from 'react'
import type { ConnectivityMap, ResourceRelation } from '@dependency-explorer/data'
import { Diagram } from '../../diagram/Diagram'
import type { FocusState } from '../../diagram/focus'
import { overviewMap } from '../../diagram/layouts/overview'
import type { Renderer } from '../../diagram/model'
import { computeImpact, impactMarks } from '../../utils/impact'

interface Props {
  map: ConnectivityMap
  relations: ResourceRelation[]
  origin: string
  renderer: Renderer
  onRenderer: (renderer: Renderer) => void
  onSelectService: (name: string) => void
}

export function ImpactMap({ map, relations, origin, renderer, onRenderer, onSelectService }: Props) {
  const model = useMemo(() => overviewMap(map, null), [map])
  const focus = useMemo<FocusState>(() => ({ spotlight: null, impact: impactMarks(computeImpact(map, relations, origin)) }), [map, relations, origin])
  return (
    <Diagram
      model={model}
      focus={focus}
      renderer={renderer}
      onRenderer={onRenderer}
      onSelect={ref => {
        if (ref.type === 'service') {
          onSelectService(ref.name)
        }
      }}
      filename={`impact_${origin}`}
      notes={[`if ${origin} is down`]}
    />
  )
}
