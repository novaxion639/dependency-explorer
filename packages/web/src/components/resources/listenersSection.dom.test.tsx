// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListenerSchema, type Listener } from '@dependency-explorer/data'
import { renderWithNav } from '../../test/renderWithNav'
import { ListenersSection } from './ListenersSection'

const at = { file: 'app/models/shift.rb', line: 196 }
const listener = ListenerSchema.parse({
  id: 'shifts.after_commit.update_paid_leaves', table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', method: 'update_paid_leaves',
  events: ['create', 'update', 'destroy'], phase: 'commit', condition: 'if: :user_id?', declaredAt: at, grade: 'code',
  effects: [{ kind: 'enqueues', target: 'UpdatePaidLeavesCounterJob', mode: 'async-job', at, grade: 'constant' }],
})

const unverified = ListenerSchema.parse({
  id: 'shifts.after_commit.touch_week', table: 'pg:skello_production.shifts', kind: 'callback', hook: 'after_commit', method: 'touch_week',
  events: ['update'], phase: 'commit', declaredAt: at, grade: 'code',
  effects: [{ kind: 'enqueues', target: 'TouchWeekJob', mode: 'async-job', at, grade: 'text' }],
})
const OPEN = 'shifts.after_commit.update_paid_leaves'
const NO_FILTERS = { lev: null, lkind: null, lgrade: null }
type Filters = { lev: string | null; lkind: string | null; lgrade: string | null }

const mount = ({ open = null, filters = NO_FILTERS, listeners = [listener], onFilters = () => {}, onToggle = () => {} }: {
  open?: string | null
  filters?: Filters
  listeners?: Listener[]
  onFilters?: (p: Partial<Filters>) => void
  onToggle?: (id: string | null) => void
} = {}) => renderWithNav(<ListenersSection listeners={listeners} filters={filters} open={open} onFilters={onFilters} onToggle={onToggle} />)

describe('ListenersSection', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('counts the listeners in the heading', () => {
    mount()

    expect(screen.getByRole('heading', { name: 'Listeners · 1 of 1' })).toBeTruthy()
  })

  it('lists each listener folded, with its hook, method and events', () => {
    mount()

    expect(screen.getByRole('button', { name: 'after_commit update_paid_leaves · create update destroy' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('shows each listener condition', () => {
    mount()

    expect(screen.getByText('if: :user_id?')).toBeTruthy()
  })

  it('toggles a row', async () => {
    const onToggle = vi.fn()
    mount({ onToggle })

    await userEvent.click(screen.getByRole('button', { name: /update_paid_leaves/ }))

    expect(onToggle).toHaveBeenCalledWith(OPEN)
  })

  it('shows the effects of an open row', () => {
    mount({ open: OPEN })

    expect(screen.getByText('enqueues UpdatePaidLeavesCounterJob · async', { exact: false })).toBeTruthy()
  })

  it('reports filter changes', async () => {
    const onFilters = vi.fn()
    mount({ onFilters })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'cascade')

    expect(onFilters).toHaveBeenCalledWith({ lkind: 'cascade' })
  })

  it.each([
    ['verified', '✓'],
    ['unverified, receiver named after a model', '~'],
  ])('grades a %s row with an accessible glyph', (name, glyph) => {
    mount({ listeners: [listener, unverified] })

    expect(screen.getByRole('img', { name }).textContent).toBe(glyph)
  })

  it('names the grade glyph of an opened effect', () => {
    mount({ open: OPEN })

    expect(screen.getAllByRole('img', { name: 'verified' })).toHaveLength(2)
  })

  it('labels the event filter Listener event', () => {
    mount()

    expect(screen.getByRole('combobox', { name: 'Listener event' })).toHaveProperty('value', 'all')
    expect(screen.queryByRole('combobox', { name: 'Event' })).toBeNull()
  })

  it('treats a filter value outside its options as no filter', () => {
    mount({ filters: { lev: null, lkind: 'bogus', lgrade: null } })

    expect(screen.getByRole('heading', { name: 'Listeners · 1 of 1' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Kind' })).toHaveProperty('value', 'all')
  })

  it('says so when the filters hide every listener', () => {
    mount({ filters: { lev: null, lkind: 'cascade', lgrade: null } })

    expect(screen.getByText('No listener matches these filters.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('prefixes the source links with declared and defined', () => {
    mount({ listeners: [ListenerSchema.parse({ ...listener, definedAt: { file: 'app/models/concerns/x.rb', line: 3 } })] })
    const sources = screen.getByText('declared', { exact: false }).textContent

    expect(sources).toContain('declared app/models/shift.rb:196')
    expect(sources).toContain('defined app/models/concerns/x.rb:3')
  })

  it('scrolls the open listener row into view', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    mount({ open: OPEN })

    expect(scrollIntoView.mock.contexts).toEqual([screen.getAllByRole('listitem')[0]])
  })

  it('names a cascade row after its target', () => {
    const cascade = ListenerSchema.parse({
      id: 'shifts.dependent.shift_swaps', table: 'pg:skello_production.shifts', kind: 'cascade', hook: 'dependent: :delete_all',
      events: ['destroy'], phase: 'event', declaredAt: at, grade: 'code', effects: [],
    })

    mount({ listeners: [cascade] })

    expect(screen.getByText('dependent: :delete_all shift_swaps')).toBeTruthy()
  })
})
