import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImpactMap } from './ImpactMap'

const noop = () => {}

describe('ImpactMap', () => {
  it('shades the impact on the microservices map', () => {
    const html = renderToStaticMarkup(<ImpactMap origin="svc-requests" renderer="svg" onRenderer={noop} onSelectService={noop} />)
    expect(html).toContain('aria-label="svc-requests — origin"')
    expect(html).toContain('aria-label="skello-app — fails"')
    expect(html).toContain('>fails<')
  })
})
