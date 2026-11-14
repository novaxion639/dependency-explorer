// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { autoFlow } from '../../diagram/layouts/fixtures'
import { renderInApp } from '../../test/renderInApp'
import { UnitDetail } from './UnitDetail'

const noop = () => {}
const texts = (role: string) => screen.getAllByRole(role).map(e => e.textContent)

describe('UnitDetail with a state machine', () => {
  it('heads a machine opened from its frame with its name', () => {
    renderInApp(<UnitDetail flow={autoFlow} id="sm-auto" onClose={noop} />)

    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['AutoAssign state machine'])
  })

  it('names where a machine falls on error', () => {
    renderInApp(<UnitDetail flow={autoFlow} id="sm-auto" onClose={noop} />)

    expect(texts('term')).toContain('Falls to the error handler')
  })

  it('lists the machine states in order', () => {
    renderInApp(<UnitDetail flow={autoFlow} id="sm-auto" onClose={noop} />)

    expect(texts('definition')).toContain('fetch data, filter users, per batch, aggregate, solve, assign shifts, finish job')
  })

  it('heads a choice opened from its node with its question', () => {
    renderInApp(<UnitDetail flow={autoFlow} id="empty" onClose={noop} />)

    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['empty?'])
  })

  it('names where a choice leads', () => {
    renderInApp(<UnitDetail flow={autoFlow} id="empty" onClose={noop} />)

    expect(texts('definition')).toContain('→ finish job')
  })
})
