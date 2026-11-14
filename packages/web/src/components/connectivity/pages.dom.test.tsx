// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderInApp } from '../../test/renderInApp'
import { FlowsIndex } from './FlowsIndex'
import { ImpactPage } from '../resources/ImpactPage'
import { dataset } from '../../test/resourceFixtures'
import { flowDataset, shiftUpdateFlow } from '../../test/flowFixtures'

const noop = () => {}
const { map } = flowDataset

describe('module pages', () => {
  it.each(map.flows.map(f => [f.name]))('lists the flow %s when no service filters the index', name => {
    renderInApp(<FlowsIndex service={null} flows={map.flows} map={map} />)

    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  })

  it('narrows the index to flows a service takes part in', () => {
    renderInApp(<FlowsIndex service="skello-app-front" flows={map.flows} map={map} />)

    expect(screen.getByRole('link', { name: /^Shift Creation/ })).toBeTruthy()
    expect(screen.queryByText(shiftUpdateFlow.name)).toBeNull()
  })

  it('asks for an origin before showing impact', () => {
    renderInApp(<ImpactPage data={dataset} origin={null} onPick={noop} onSelect={noop} />)

    expect(screen.getByRole('combobox', { name: 'Service or resource' })).toBeTruthy()
  })

  it('shows the impact of a picked origin', () => {
    renderInApp(<ImpactPage data={dataset} origin="svc-requests" onPick={noop} onSelect={noop} />)

    expect(screen.getByRole('heading', { name: 'If svc-requests is down' })).toBeTruthy()
  })
})

describe('flow cards', () => {
  it('link each flow to its page', () => {
    renderInApp(<FlowsIndex service={null} flows={map.flows} map={map} />)

    expect(screen.getByRole('link', { name: /^Shift Creation/ }).getAttribute('href')).toBe('/?page=flows&flow=shift-creation')
  })
})
