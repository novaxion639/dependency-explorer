import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImpactMap } from './ImpactMap'

const noop = () => {}

describe('ImpactMap', () => {
  it('draws the microservices map with the impact legend', () => {
    const html = renderToStaticMarkup(<ImpactMap origin="svc-requests" onSelectService={noop} />)
    expect(html).toContain('>if svc-requests is down<')
    expect(html).toContain('>fails<')
  })
})
