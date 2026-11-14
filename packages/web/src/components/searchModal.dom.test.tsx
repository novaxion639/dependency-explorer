// @vitest-environment jsdom
import { beforeAll, describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { searchIndex } from '../shell/dataIndexes'
import { searchEntries } from '../utils/searchIndex'
import { renderInApp } from '../test/renderInApp'
import { SearchModal } from './SearchModal'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
})

const open = () => {
  const onNavigate = vi.fn()
  const onClose = vi.fn()
  const view = renderInApp(<SearchModal index={searchIndex} onNavigate={onNavigate} onClose={onClose} />)
  return { ...view, onNavigate, onClose }
}

const combobox = () => screen.getByRole('combobox', { name: 'Search' })

describe('SearchModal', () => {
  it('is a modal dialog named Search', () => {
    open()

    expect(screen.getByRole('dialog', { name: 'Search' }).getAttribute('aria-modal')).toBe('true')
  })

  it('focuses the search box on open', () => {
    open()

    expect(document.activeElement).toBe(combobox())
  })

  it('points the combobox at its listbox and first option', async () => {
    open()

    await userEvent.type(combobox(), 'svc-punch')

    const [first] = within(screen.getByRole('listbox', { name: 'Results' })).getAllByRole('option')
    expect(combobox().getAttribute('aria-controls')).toBe(screen.getByRole('listbox', { name: 'Results' }).id)
    expect(combobox().getAttribute('aria-activedescendant')).toBe(first?.id)
  })

  it('moves the active option with ArrowDown', async () => {
    open()

    await userEvent.type(combobox(), 'svc-punch{ArrowDown}')

    const [, second] = screen.getAllByRole('option')
    expect(combobox().getAttribute('aria-activedescendant')).toBe(second?.id)
  })

  it('opens the active result on Enter', async () => {
    const { onNavigate } = open()

    await userEvent.type(combobox(), 'svc-punch{Enter}')

    expect(onNavigate).toHaveBeenCalledWith(searchEntries(searchIndex, 'svc-punch')[0]?.patch)
  })

  it('closes on Escape', async () => {
    const { onClose } = open()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps Tab on the search box, so the arrow keys keep working', async () => {
    open()

    await userEvent.tab()

    expect(document.activeElement).toBe(combobox())
  })

  it('gives focus back to the opener when it closes', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = open()

    unmount()

    expect(document.activeElement).toBe(opener)
  })

  it('names listeners and jobs among the kinds it searches', () => {
    open()

    expect(screen.getByText(/listeners and jobs/)).toBeTruthy()
  })
})
