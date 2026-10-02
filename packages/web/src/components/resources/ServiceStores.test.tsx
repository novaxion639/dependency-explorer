import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap, resourceIdForDatabase, resourceSurface } from '@dependency-explorer/data'
import { ServiceStores } from './ServiceStores'

describe('ServiceStores', () => {
  it('links each resolvable database of a service to its resource', () => {
    const svc = connectivityMap.services.find(s => (s.databases ?? []).some(db => resourceIdForDatabase(s.name, db, resourceSurface.resources)))
    const db = svc?.databases?.find(d => resourceIdForDatabase(svc.name, d, resourceSurface.resources))
    if (!svc || !db) {
      throw new Error('no service database resolves to a resource')
    }
    const html = renderToStaticMarkup(<ServiceStores service={svc} onOpenResource={() => {}} />)
    expect(html).toContain('aria-label="Stores"')
    expect(html).toContain(`>${db.name}</button>`)
  })
})
