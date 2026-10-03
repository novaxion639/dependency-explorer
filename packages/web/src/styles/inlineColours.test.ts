import { describe, it, expect } from 'vitest'

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true })
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

const LEGACY_DIAGRAM_FILES = new Set([
  'components/ExportPngButton.tsx',
  'components/areas/SystemContext.tsx',
  'components/connectivity/CodeUnitDetailPanel.tsx',
  'components/connectivity/ConnectivityEdge.tsx',
  'components/connectivity/ConnectivityGraph.tsx',
  'components/connectivity/EdgeBadges.tsx',
  'components/connectivity/FlowGraphModal.tsx',
  'components/connectivity/SequenceDiagram.tsx',
  'components/nodes/CodeUnitNode.tsx',
  'components/nodes/DatabaseNode.tsx',
  'components/nodes/ServiceNode.tsx',
  'utils/buildConnectivityGraph.ts',
  'utils/buildFlowCodeGraph.ts',
  'utils/buildFlowGraph.ts',
])

const PENDING_4A = new Set([
  'components/SearchModal.tsx',
  'components/connectivity/ServiceSidebar.tsx',
  'components/ownership/OwnershipPage.tsx',
])

const offenders = Object.entries(sources).filter(([, src]) => COLOUR_LITERAL.test(src)).map(([path]) => path.replace(/^\.\.\//, '')).sort()

describe('inline colour literals', () => {
  it('appear only in legacy diagram files and files still pending migration', () => {
    expect(offenders.filter(f => !LEGACY_DIAGRAM_FILES.has(f) && !PENDING_4A.has(f))).toEqual([])
  })
  it('lists only files that still carry literals, so each list shrinks as files migrate', () => {
    expect([...LEGACY_DIAGRAM_FILES, ...PENDING_4A].filter(f => !offenders.includes(f)).sort()).toEqual([])
  })
})
