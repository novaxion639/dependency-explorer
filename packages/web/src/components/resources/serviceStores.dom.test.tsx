// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { connectivityMap, resourceIdForDatabase, resourceSurface } from '@dependency-explorer/data'
import { renderInApp } from '../../test/renderInApp'
import { ServiceStores } from './ServiceStores'

const storesWithResources = connectivityMap.services.flatMap(service =>
  (service.databases ?? []).flatMap(db => {
    const id = resourceIdForDatabase(service.name, db, resourceSurface.resources)
    return id ? [{ service, db, id }] : []
  }))

describe('ServiceStores', () => {
  it('finds at least one database that resolves to a resource', () => {
    expect(storesWithResources.length).toBeGreaterThan(0)
  })

  it.each(storesWithResources.slice(0, 1).map(s => [s.service.name, s]))('links %s’s resolvable database to its resource page', (_name, { service, db, id }) => {
    renderInApp(<ServiceStores service={service} />)

    const link = within(screen.getByLabelText('Stores')).getAllByRole('link', { name: db.name })[0]

    expect(link?.getAttribute('href')).toBe(`/?page=resources&resource=${encodeURIComponent(id)}`)
  })
})
