// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { connectivityMap } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { FlowsIndex } from './FlowsIndex'
import { ImpactPage } from '../resources/ImpactPage'

const noop = () => {}
const outside = connectivityMap.flows.find(f => !f.steps.some(s => s.from === 'svc-punch' || s.to === 'svc-punch'))

describe('module pages', () => {
  it.each(connectivityMap.flows.map(f => [f.name]))('lists the flow %s when no service filters the index', name => {
    render(<FlowsIndex service={null} flows={connectivityMap.flows} map={connectivityMap} onSelectFlow={noop} />)

    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  })

  it('narrows the index to flows a service takes part in', () => {
    render(<FlowsIndex service="svc-punch" flows={connectivityMap.flows} map={connectivityMap} onSelectFlow={noop} />)

    expect(outside, 'a flow svc-punch takes no part in').toBeDefined()
    expect(screen.queryByText(outside?.name ?? '')).toBeNull()
  })

  it('asks for an origin before showing impact', () => {
    renderInApp(<ImpactPage origin={null} onPick={noop} onSelect={noop} />)

    expect(screen.getByRole('combobox', { name: 'Service or resource' })).toBeTruthy()
  })

  it('shows the impact of a picked origin', () => {
    renderInApp(<ImpactPage origin="svc-requests" onPick={noop} onSelect={noop} />)

    expect(screen.getByRole('heading', { name: 'If svc-requests is down' })).toBeTruthy()
  })
})
