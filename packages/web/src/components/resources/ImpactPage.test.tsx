import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImpactPage } from './ImpactPage'

const noop = () => {}

describe('ImpactPage', () => {
  it('lists the directed impact of a service by hop with effects and affected flows', () => {
    const html = renderToStaticMarkup(<ImpactPage origin="svc-requests" onSelect={noop} onOpenFlow={noop} onPick={noop} />)
    expect(html).toContain('aria-label="Impact of svc-requests"')
    expect(html).toContain('Hop 1')
    expect(html).toContain('>fails<')
    expect(html).toContain('aria-label="Affected flows"')
  })
  it('labels the page once, without a redundant region role', () => {
    expect(renderToStaticMarkup(<ImpactPage origin="svc-requests" onSelect={noop} onOpenFlow={noop} onPick={noop} />)).not.toContain('role="region"')
  })
  it('impacts a resource through its relations', () => {
    expect(renderToStaticMarkup(<ImpactPage origin="sqs:createActivityLogJob" onSelect={noop} onOpenFlow={noop} onPick={noop} />)).toContain('svc-requests')
  })
  it('marks failures beyond the first hop as possible', () => {
    const html = renderToStaticMarkup(<ImpactPage origin="svc-requests" onSelect={noop} onOpenFlow={noop} onPick={noop} />)
    expect(html).toContain('>may fail<')
  })
  it('keeps the map folded until asked', () => {
    const html = renderToStaticMarkup(<ImpactPage origin="svc-requests" onSelect={noop} onOpenFlow={noop} onPick={noop} />)
    expect(html).toMatch(/aria-expanded="false"[^>]*>Show on the map</)
  })
})
