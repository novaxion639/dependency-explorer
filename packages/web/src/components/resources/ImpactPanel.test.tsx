import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImpactPanel } from './ImpactPanel'

const noop = () => {}

describe('ImpactPanel', () => {
  it('lists the directed impact of a service by hop with effects and affected flows', () => {
    const html = renderToStaticMarkup(<ImpactPanel origin="svc-requests" onSelect={noop} onOpenFlow={noop} onClose={noop} />)
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Impact of svc-requests"')
    expect(html).toContain('Hop 1')
    expect(html).toContain('>fails<')
    expect(html).toContain('aria-label="Affected flows"')
  })
  it('keeps only hard failures through sync edges under the sync filter', () => {
    const html = renderToStaticMarkup(<ImpactPanel origin="svc-requests" initialFilter="sync" onSelect={noop} onOpenFlow={noop} onClose={noop} />)
    expect(html).not.toContain('>degrades<')
    expect(html).not.toContain('>starves<')
    expect(html).toContain('>fails<')
  })
  it('impacts a resource through its relations', () => {
    expect(renderToStaticMarkup(<ImpactPanel origin="sqs:createActivityLogJob" onSelect={noop} onOpenFlow={noop} onClose={noop} />)).toContain('svc-requests')
  })
  it('marks failures beyond the first hop as possible', () => {
    const html = renderToStaticMarkup(<ImpactPanel origin="svc-requests" onSelect={noop} onOpenFlow={noop} onClose={noop} />)
    expect(html).toContain('>may fail<')
  })
})
