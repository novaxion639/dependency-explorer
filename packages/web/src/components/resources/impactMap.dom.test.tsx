// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderInApp } from '../../test/renderInApp'
import { ImpactMap } from './ImpactMap'

const noop = () => {}
const render = () => renderInApp(<ImpactMap origin="svc-requests" renderer="svg" onRenderer={noop} onSelectService={noop} />)

describe('ImpactMap', () => {
  it.each(['svc-requests — origin', 'skello-app — fails'])('shades %s on the microservices map', name => {
    render()

    expect(screen.getByRole('button', { name })).toBeTruthy()
  })

  it('explains the fails shade in the legend', () => {
    render()

    expect(within(screen.getByRole('list', { name: 'Legend' })).getByText('fails')).toBeTruthy()
  })
})
