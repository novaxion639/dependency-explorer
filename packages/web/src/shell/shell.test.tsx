import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseUrl } from '../hooks/useUrlState'
import { AppShell } from './AppShell'
import { Rail } from './Rail'

const noop = () => {}
const shell = (qs: string, panel: string | null = null) => renderToStaticMarkup(
  <AppShell url={parseUrl(qs)} onNavigate={noop} onSearch={noop} onTogglePresent={noop} panel={panel}><p>canvas</p></AppShell>,
)

describe('Rail', () => {
  it('groups modules by question and marks the current page', () => {
    const html = renderToStaticMarkup(<Rail page="monolith" onNavigate={noop} />)
    for (const label of ['Understand', 'Change', 'People', 'Product areas', 'Architecture', 'Monolith', 'Microservices', 'Flows', 'Resources', 'Impact', 'Ownership']) {
      expect(html, label).toContain(label)
    }
    expect(html).toContain('aria-label="Modules"')
    expect(html).toMatch(/aria-current="page"[^>]*>[^<]*<span[^>]*>Monolith/)
  })
})

describe('AppShell', () => {
  it('shows home without rail or breadcrumb', () => {
    const html = shell('')
    expect(html).not.toContain('aria-label="Modules"')
    expect(html).not.toContain('aria-label="Breadcrumb"')
    expect(html).toContain('canvas')
  })
  it('frames inner pages with the rail, the breadcrumb and the panel', () => {
    const html = shell('?page=microservices&s=svc-punch', 'edge detail')
    expect(html).toContain('aria-label="Modules"')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('svc-punch')
    expect(html).toContain('aria-label="Details"')
    expect(html).toContain('edge detail')
  })
  it('offers the rail behind a Menu button', () => {
    expect(shell('?page=resources')).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Menu<\/button>/)
  })
  it('hides the rail and panel in present mode', () => {
    const html = shell('?page=microservices&s=svc-punch&present=1', 'edge detail')
    expect(html).not.toContain('aria-label="Modules"')
    expect(html).not.toContain('aria-label="Details"')
    expect(html).toContain('data-present="true"')
    expect(html).toContain('Exit present')
  })
})
