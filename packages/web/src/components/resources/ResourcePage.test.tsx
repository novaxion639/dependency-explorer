import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { allResourceRelations, resourceSurface } from '@dependency-explorer/data'
import { ResourcePage } from './ResourcePage'
import { ResourcesIndex } from './ResourcesIndex'

const noop = () => {}
const props = { onOpenResource: noop, onOpenFile: noop, onOpenFlow: noop, onSelectService: noop, onBlast: noop }

describe('ResourcePage', () => {
  it('shows the change impact of the shifts table with graded files and flows', () => {
    const html = renderToStaticMarkup(<ResourcePage id="pg:skello_production.shifts" {...props} />)
    expect(html).toContain('<h1')
    expect(html).toContain('shifts')
    expect(html).toMatch(/\d+ services · \d+ files · \d+ flows/)
    expect(html).toContain('app/models/shift.rb')
    expect(html).toContain('aria-label="Writers"')
    expect(html).toContain('instance writes')
  })
  it('links evidence to GitHub at the pinned commit', () => {
    const html = renderToStaticMarkup(<ResourcePage id="pg:skello_production.shifts" {...props} />)
    expect(html).toMatch(/href="https:\/\/github\.com\/skelloapp\/skello-app\/blob\/[0-9a-f]{40}\/db\/schema\.rb"/)
  })
  it('lists the tables of the monolith database', () => {
    const html = renderToStaticMarkup(<ResourcePage id="pg:skello_production" {...props} />)
    expect(html).toContain('aria-label="Tables"')
    expect(html).toContain('>shifts</button>')
  })
  it('renders a resource with no relations without throwing', () => {
    const quiet = resourceSurface.resources.find(r => !allResourceRelations.some(x => x.resource === r.id))
    expect(quiet, 'the registry holds at least one untouched resource (dataset-only stores)').toBeDefined()
    expect(renderToStaticMarkup(<ResourcePage id={quiet?.id ?? ''} {...props} />)).toContain('No code, config or flow touches this resource')
  })
})

describe('ResourcesIndex', () => {
  it('groups every resource by store', () => {
    const html = renderToStaticMarkup(<ResourcesIndex onOpenResource={noop} />)
    for (const store of new Set(resourceSurface.resources.map(r => r.store))) {
      expect(html).toContain(`aria-label="${store}"`)
    }
    expect(html).toContain('aria-label="Owner"')
  })
})
