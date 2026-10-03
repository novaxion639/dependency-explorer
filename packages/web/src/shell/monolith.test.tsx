import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseUrl } from '../hooks/useUrlState'
import { MonolithPage } from './MonolithPage'
import { validateUrlState } from './validateUrlState'

const noop = () => {}
const page = (qs: string) => renderToStaticMarkup(<MonolithPage url={validateUrlState(parseUrl(qs))} patch={noop} />)

describe('MonolithPage', () => {
  it('ranks skello-app by product area when exploring', () => {
    const html = page('?page=monolith')
    expect(html).toContain('<table')
    expect(html).toContain('Not mapped yet')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Inside · by product area</)
  })
  it('draws the treemap when presenting', () => {
    const html = page('?page=monolith&present=1&renderer=svg')
    expect(html).not.toContain('<table')
    expect(html).toContain('role="img" aria-label="skello-app by product area"')
  })
  it("shows skello-app's connections on the Connections view", () => {
    const html = page('?page=monolith&s=skello-app&renderer=svg')
    expect(html).toContain('skello-app — grouped by how they talk')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Connections</)
  })
})
