// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import mermaid from 'mermaid'
import { connectivityMap as map } from '@dependency-explorer/data'
import { emphasise, NO_FOCUS } from '../focus'
import { toMermaid } from '../renderers/toMermaid'
import { machineFixtures } from './fixtures'
import { swimlanes } from './swimlane'

describe('Mermaid source of every flow', () => {
  it('parses', async () => {
    for (const f of [...machineFixtures, ...map.flows]) {
      const m = swimlanes(f)
      await expect(mermaid.parse(toMermaid(m, emphasise(m, NO_FOCUS), () => 'black')), f.id).resolves.toBeTruthy()
    }
  }, 30_000)
})
