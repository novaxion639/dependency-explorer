import { describe, expect, it } from 'vitest'
import { catalogEntryOf, featureKey } from './catalog'

describe('featureKey', () => {
  it('normalises underscores, brackets, slashes and dashes', () => {
    expect(featureKey('Ranking (grids, exports, reports)')).toBe('ranking')
    expect(featureKey('Route optimizer [Beta]')).toBe('route optimizer')
    expect(featureKey('Crew alerts / Homepage')).toBe(featureKey('Crew_alerts_and_homepage'))
    expect(featureKey('Dock-attached documents')).toBe('dock attached documents')
  })

  it('collapses whitespace and lower-cases', () => {
    expect(featureKey('  Planning \t GRID ')).toBe('planning grid')
  })

  it('keeps a parenthesis that spans a newline', () => {
    expect(featureKey('Ranking (a\nb)')).toBe('ranking (a b)')
  })
})

describe('catalogEntryOf', () => {
  it('matches Grille_hebdomadaire style labels after normalising', () => {
    expect(catalogEntryOf('Staff_needs')).toEqual({ name: 'Staff needs', tribe: 'Scheduling' })
    expect(catalogEntryOf('staff needs [Beta]')).toEqual({ name: 'Staff needs', tribe: 'Scheduling' })
    expect(catalogEntryOf('Clock in API access')).toEqual({ name: 'Clock-in API access', tribe: 'Connect' })
    expect(catalogEntryOf('Document/contract templates and generation')?.name).toBe('Document and contract templates and generation')
  })

  it('resolves the Staff needs alias Staffing requirements', () => {
    expect(catalogEntryOf('Staffing requirements')).toEqual({ name: 'Staff needs', tribe: 'Scheduling' })
  })

  it('returns null for an unknown label', () => {
    expect(catalogEntryOf('Grille_hebdomadaire')).toBeNull()
  })

  it('maps Sans tribe to null', () => {
    expect(catalogEntryOf('Smart Planner')).toEqual({ name: 'Smart Planner', tribe: null })
  })
})
