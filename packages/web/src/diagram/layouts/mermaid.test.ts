// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import mermaid from 'mermaid'
import { connectivityMap as map, resourceSurface } from '@dependency-explorer/data'
import { emphasise, NO_FOCUS } from '../focus'
import { toMermaid } from '../renderers/toMermaid'
import { areaGraph } from './areaGraph'
import { areaId } from './ids'
import { overviewMap } from './overview'
import { serviceByArea } from './serviceByArea'
import { serviceByHow } from './serviceByHow'

const read = () => 'black'

describe('Mermaid source of every real view', () => {
  it('parses', async () => {
    const models = [
      overviewMap(map, null),
      overviewMap(map, areaId('planning')),
      areaGraph(map, 1),
      ...map.services.flatMap(s => [serviceByHow(map, resourceSurface.resources, s.name), serviceByArea(map, resourceSurface.resources, s.name)]),
    ]
    for (const m of models) {
      const focus = m.id === 'overview' ? { spotlight: areaId('planning'), impact: null } : NO_FOCUS
      await expect(mermaid.parse(toMermaid(m, emphasise(m, focus), read)), m.id).resolves.toBeTruthy()
    }
  }, 30_000)
})
