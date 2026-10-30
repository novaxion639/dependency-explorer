import { useMemo } from 'react'
import { allResourceRelations, connectivityMap } from '@dependency-explorer/data'
import { Diagram } from '../../diagram/Diagram'
import type { FocusState } from '../../diagram/focus'
import { overviewMap } from '../../diagram/layouts/overview'
import { computeImpact, impactMarks } from '../../utils/impact'

const MODEL = overviewMap(connectivityMap, null)

interface Props {
  origin: string
  onSelectService: (name: string) => void
}

export function ImpactMap({ origin, onSelectService }: Props) {
  const focus = useMemo<FocusState>(() => ({ spotlight: null, impact: impactMarks(computeImpact(connectivityMap, allResourceRelations, origin)) }), [origin])
  return (
    <Diagram
      model={MODEL}
      focus={focus}
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
