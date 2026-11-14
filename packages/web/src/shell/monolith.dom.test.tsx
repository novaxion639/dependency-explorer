// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { parseUrl } from '../hooks/useUrlState'
import { renderInApp } from '../test/renderInApp'
import { MonolithPage } from './MonolithPage'
import { validateUrlState } from './validateUrlState'

const noop = () => {}
const page = (qs: string) => renderInApp(<MonolithPage url={validateUrlState(parseUrl(qs))} patch={noop} />, qs)

describe('MonolithPage', () => {
  it('ranks skello-app by product area in a table when exploring', () => {
    page('?page=monolith')

    expect(screen.getByRole('table', { name: 'skello-app by product area' })).toBeTruthy()
  })

  it('gives the files not mapped yet a row when exploring', () => {
    page('?page=monolith')

    expect(within(screen.getByRole('table')).getByRole('row', { name: /^Not mapped yet/ })).toBeTruthy()
  })

  it('presses the inside view when exploring', () => {
    page('?page=monolith')

    expect(screen.getByRole('button', { name: 'Inside · by product area', pressed: true })).toBeTruthy()
  })

  it('draws the treemap instead of the table when presenting', () => {
    page('?page=monolith&present=1&renderer=svg')

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('img', { name: 'skello-app by product area' })).toBeTruthy()
  })

  it("shows skello-app's connections on the Connections view", () => {
    page('?page=monolith&s=skello-app&renderer=svg')

    expect(screen.getByRole('region', { name: 'skello-app — grouped by how they talk' })).toBeTruthy()
  })

  it('presses the Connections view on skello-app', () => {
    page('?page=monolith&s=skello-app&renderer=svg')

    expect(screen.getByRole('button', { name: 'Connections', pressed: true })).toBeTruthy()
  })
})
