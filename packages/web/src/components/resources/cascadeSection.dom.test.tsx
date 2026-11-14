// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resourcePatch } from '../../hooks/useUrlState'
import { renderInApp } from '../../test/renderInApp'
import { CascadeSection } from './CascadeSection'
import { WritePathsSection } from './WritePathsSection'

const SHIFTS = 'pg:skello_production.shifts'
const noop = () => {}
const alsoChanges = () => screen.getByRole('region', { name: 'Also changes' })

describe('CascadeSection', () => {
  it('draws the shifts update cascade with weekly_options reached asynchronously', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)

    expect(within(alsoChanges()).getByRole('link', { name: 'weekly_options' })).toBeTruthy()
  })

  it('selects the update event by default', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)

    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('update')
  })

  it('switches the event', async () => {
    const onEvent = vi.fn()
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={onEvent} />)

    await userEvent.click(screen.getByRole('button', { name: 'destroy' }))

    expect(onEvent).toHaveBeenCalledWith('destroy')
  })

  it('labels the cascade event group', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)

    expect(within(screen.getByRole('group', { name: 'Cascade event' })).getByRole('button', { pressed: true }).textContent).toBe('update')
  })

  it('counts the reached tables across all events in the heading', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)

    expect(within(alsoChanges()).getByRole('heading', { name: /^Also changes · \d+ tables across all events$/ })).toBeTruthy()
  })

  it('names the events each hop writes', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)
    const hops = within(alsoChanges()).getAllByRole('listitem').map(h => h.textContent)

    expect(hops).not.toContainEqual(expect.not.stringMatching(/← \S+ · (sync|async) · (create|update|destroy)( (create|update|destroy))*/))
  })

  it('says so when the selected event reaches no table', () => {
    renderInApp(<CascadeSection table="pg:skello_production.billing_infos" event="create" onEvent={noop} />)

    expect(screen.getByText('No table changes on create.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('gives every hop an accessible grade glyph', () => {
    renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)
    const glyphs = within(alsoChanges()).getAllByRole('img')

    expect(within(alsoChanges()).getAllByRole('img', { name: /.+/ })).toHaveLength(glyphs.length)
  })

  it('opens the reached table', async () => {
    const { onNavigate } = renderInApp(<CascadeSection table={SHIFTS} event={null} onEvent={noop} />)

    await userEvent.click(screen.getByRole('link', { name: 'weekly_options' }))

    expect(onNavigate).toHaveBeenCalledWith(resourcePatch('pg:skello_production.weekly_options'), undefined)
  })

  it('renders nothing for a table that reaches no other table', () => {
    renderInApp(<CascadeSection table="pg:skello_production.no_such_table" event={null} onEvent={noop} />)

    expect(screen.queryByRole('region')).toBeNull()
  })
})

describe('WritePathsSection', () => {
  const writePaths = () => screen.getByRole('region', { name: 'Write paths' })

  it('groups shift write paths by what they run', () => {
    render(<WritePathsSection table={SHIFTS} onOpenFlow={noop} />)

    expect(within(writePaths()).getAllByRole('heading', { name: /^Runs no listener \d+$/ }).length).toBeGreaterThan(0)
  })

  it('gives each write path its source', () => {
    render(<WritePathsSection table={SHIFTS} onOpenFlow={noop} />)

    expect(within(writePaths()).getAllByText('written at').length).toBeGreaterThan(0)
  })

  it('grades each write path with an accessible glyph', () => {
    render(<WritePathsSection table={SHIFTS} onOpenFlow={noop} />)

    expect(within(writePaths()).getAllByRole('img', { name: /.+/ }).length).toBeGreaterThan(0)
  })

  it('renders nothing for a table with no write site', () => {
    render(<WritePathsSection table="pg:skello_production.no_such_table" onOpenFlow={noop} />)

    expect(screen.queryByRole('region')).toBeNull()
  })
})
