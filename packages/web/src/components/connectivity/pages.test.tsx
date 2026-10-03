import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap } from '@dependency-explorer/data'
import { FlowsIndex } from './FlowsIndex'
import { ImpactPage } from '../resources/ImpactPage'

const noop = () => {}

describe('module pages', () => {
  it('lists every flow when no service filters the index', () => {
    const html = renderToStaticMarkup(<FlowsIndex service={null} flows={connectivityMap.flows} map={connectivityMap} onSelectFlow={noop} />)
    for (const f of connectivityMap.flows) {
      expect(html, f.id).toContain(f.name.replace(/&/g, '&amp;'))
    }
  })
  it('narrows the index to flows a service takes part in', () => {
    const html = renderToStaticMarkup(<FlowsIndex service="svc-punch" flows={connectivityMap.flows} map={connectivityMap} onSelectFlow={noop} />)
    const outside = connectivityMap.flows.find(f => !f.steps.some(s => s.from === 'svc-punch' || s.to === 'svc-punch'))
    if (!outside) {
      throw new Error('every flow touches svc-punch')
    }
    expect(html).not.toContain(outside.name)
  })
  it('asks for an origin before showing impact', () => {
    expect(renderToStaticMarkup(<ImpactPage origin={null} onPick={noop} onSelect={noop} onOpenFlow={noop} />)).toContain('aria-label="Service or resource"')
    expect(renderToStaticMarkup(<ImpactPage origin="svc-requests" onPick={noop} onSelect={noop} onOpenFlow={noop} />)).toContain('svc-requests')
  })
})
