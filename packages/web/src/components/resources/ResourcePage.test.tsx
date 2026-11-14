// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { allResourceRelations, resourceSurface } from '@dependency-explorer/data'
import { parseUrl } from '../../hooks/useUrlState'
import { renderWithNav } from '../../test/renderWithNav'
import { ResourcePage } from './ResourcePage'
import { ResourcesIndex } from './ResourcesIndex'

const noop = () => {}
const SHIFTS = 'pg:skello_production.shifts'
const props = { onOpenResource: noop, onOpenFlow: noop, onBlast: noop, listeners: { event: null, listener: null, lev: null, lkind: null, lgrade: null }, onListeners: noop }
const quiet = resourceSurface.resources.find(r => !allResourceRelations.some(x => x.resource === r.id))

describe('ResourcePage', () => {
  it('heads the shifts table with its name', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(screen.getByRole('heading', { level: 1, name: 'shifts' })).toBeTruthy()
  })

  it('counts the services, files and flows the shifts table changes', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(screen.getAllByText(/\d+ services · \d+ files · \d+ flows/).length).toBeGreaterThan(0)
  })

  it('shows the graded writer files', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(within(screen.getByRole('region', { name: 'Writers' })).getAllByText('app/models/shift.rb', { exact: false }).length).toBeGreaterThan(0)
  })

  it('explains where instance writes appear', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(screen.getByText(/instance writes/)).toBeTruthy()
  })

  it('links evidence to GitHub at the pinned commit', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(screen.getAllByRole('link').map(l => l.getAttribute('href'))).toContainEqual(expect.stringMatching(/^https:\/\/github\.com\/skelloapp\/skello-app\/blob\/[0-9a-f]{40}\/db\/schema\.rb$/))
  })

  it('lists the tables of the monolith database', () => {
    renderWithNav(<ResourcePage id="pg:skello_production" {...props} />)

    expect(within(screen.getByRole('region', { name: 'Tables' })).getByRole('button', { name: 'shifts' })).toBeTruthy()
  })

  it('lists the shifts table listeners from the committed surface', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(within(screen.getByRole('region', { name: 'Listeners' })).getAllByText('update_paid_leaves', { exact: false }).length).toBeGreaterThan(0)
  })

  it('renders a resource with no relations without throwing', () => {
    renderWithNav(quiet && <ResourcePage id={quiet.id} {...props} />)

    expect(quiet, 'the registry holds at least one untouched resource (dataset-only stores)').toBeDefined()
    expect(screen.getByText('No code, config or flow touches this resource', { exact: false })).toBeTruthy()
  })

  it.each(['Also changes', 'Write paths'])('shows the %s section of a shift write', name => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(screen.getByRole('region', { name })).toBeTruthy()
  })

  it('groups the shift write paths that run no listener', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(within(screen.getByRole('region', { name: 'Write paths' })).getAllByRole('heading', { name: /^Runs no listener/ }).length).toBeGreaterThan(0)
  })

  it('shows the CDC feed and its target stream inside the Feeds section', () => {
    renderWithNav(<ResourcePage id={SHIFTS} {...props} />)

    expect(within(screen.getByRole('region', { name: 'Feeds' })).getAllByText('kinesis:skelloapp-bus', { exact: false }).length).toBeGreaterThan(0)
  })
})

describe('ResourcesIndex', () => {
  it.each([...new Set(resourceSurface.resources.map(r => r.store))])('groups the resources of the %s store', store => {
    renderWithNav(<ResourcesIndex url={parseUrl('?page=resources')} patch={noop} onOpenResource={noop} />)

    expect(screen.getByRole('region', { name: store })).toBeTruthy()
  })

  it('filters the index by owner', () => {
    renderWithNav(<ResourcesIndex url={parseUrl('?page=resources')} patch={noop} onOpenResource={noop} />)

    expect(screen.getByRole('combobox', { name: 'Owner' })).toBeTruthy()
  })
})
