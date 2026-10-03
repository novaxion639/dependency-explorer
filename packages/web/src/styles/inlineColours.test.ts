import { describe, it, expect } from 'vitest'

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true })
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

const LEGACY_DIAGRAM_FILES = new Set([
  'components/ExportPngButton.tsx',
  'components/connectivity/CodeUnitDetailPanel.tsx',
  'components/connectivity/ConnectivityEdge.tsx',
  'components/connectivity/EdgeBadges.tsx',
  'components/connectivity/SequenceDiagram.tsx',
  'components/nodes/CodeUnitNode.tsx',
  'components/nodes/DatabaseNode.tsx',
  'components/nodes/ServiceNode.tsx',
  'utils/buildFlowCodeGraph.ts',
  'utils/buildFlowGraph.ts',
])

const offenders = Object.entries(sources).filter(([, src]) => COLOUR_LITERAL.test(src)).map(([path]) => path.replace(/^\.\.\//, '')).sort()

describe('inline colour literals', () => {
  it('appear only in legacy diagram files', () => {
    expect(offenders.filter(f => !LEGACY_DIAGRAM_FILES.has(f))).toEqual([])
  })
  it('lists only files that still carry literals, so each list shrinks as files migrate', () => {
    expect([...LEGACY_DIAGRAM_FILES].filter(f => !offenders.includes(f)).sort()).toEqual([])
  })
})
