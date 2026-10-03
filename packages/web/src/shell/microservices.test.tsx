import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseUrl } from '../hooks/useUrlState'
import { MicroservicesPage } from './MicroservicesPage'
import { validateUrlState } from './validateUrlState'

const noop = () => {}
const page = (qs: string) => renderToStaticMarkup(<MicroservicesPage url={validateUrlState(parseUrl(qs))} patch={noop} />)

describe('MicroservicesPage', () => {
  it('maps the microservices by product area when exploring', () => {
    const html = page('?page=microservices&renderer=svg')
    expect(html).toContain('aria-label="Microservices by product area"')
    expect(html).toContain('aria-label="Planning"')
    expect(html).toContain('select an area to draw its connections')
    expect(html).toContain('aria-label="Services"')
  })
  it('draws the weighted area graph with a threshold slider, without the service list, when presenting', () => {
    const html = page('?page=microservices&renderer=svg&present=1')
    expect(html).toContain('aria-label="How product areas connect"')
    expect(html).toContain('aria-label="Minimum connections per edge"')
    expect(html).not.toContain('aria-label="Services"')
  })
  it('groups a service by how its neighbours talk when exploring, by product area when presenting', () => {
    expect(page('?page=microservices&s=svc-punch&renderer=svg')).toContain('svc-punch — grouped by how they talk')
    expect(page('?page=microservices&s=svc-punch&renderer=svg&present=1')).toContain('svc-punch — neighbours by product area')
  })
  it('gives the overview the room of the services list while a panel is open', () => {
    expect(page('?page=microservices')).toContain('aria-label="Services"')
    expect(page('?page=microservices&area=planning')).not.toContain('aria-label="Services"')
    expect(page('?page=microservices&s=svc-punch&drawer=svc-users')).toContain('aria-label="Services"')
  })
})
