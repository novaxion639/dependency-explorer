import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { DatabaseNode } from './DatabaseNode'

const render = (resources: string[]) => renderToStaticMarkup(
  <ReactFlowProvider><DatabaseNode data={{ dbType: 'postgresql', name: 'skello_production — shifts, badgings', description: '', resources }} /></ReactFlowProvider>,
)

describe('DatabaseNode', () => {
  it('offers every resource of an aggregate node as its own button', () => {
    const html = render(['pg:skello_production.shifts', 'pg:skello_production.badgings'])
    expect(html).toContain('>shifts</button>')
    expect(html).toContain('>badgings</button>')
  })
  it('renders no resource buttons for a single-resource node', () => {
    expect(render(['pg:skello_production.shifts'])).not.toContain('</button>')
  })
})
