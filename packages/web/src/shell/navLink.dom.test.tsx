// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flowPatch } from '../hooks/useUrlState'
import { renderWithNav } from '../test/renderWithNav'
import { NavLink } from './NavLink'

const renderLink = (qs: string) => {
  const { onNavigate } = renderWithNav(<NavLink patch={flowPatch('shift-creation')}>Shift creation</NavLink>, qs)
  return { onNavigate, link: screen.getByRole('link', { name: 'Shift creation' }) }
}

describe('NavLink', () => {
  it('points at the permalink of the patched state, keeping the renderer', () => {
    const { link } = renderLink('?page=microservices&s=svc-punch&renderer=svg')

    expect(link.getAttribute('href')).toBe('/?page=flows&flow=shift-creation&renderer=svg')
  })

  it('navigates in place on a plain click', async () => {
    const { onNavigate, link } = renderLink('')

    await userEvent.click(link)

    expect(onNavigate).toHaveBeenCalledWith(flowPatch('shift-creation'), undefined)
  })

  it.each([['metaKey'], ['ctrlKey'], ['shiftKey']])('leaves a %s click to the browser', modifier => {
    const { onNavigate, link } = renderLink('')
    const preventedBeforeWindow: boolean[] = []
    window.addEventListener('click', e => {
      preventedBeforeWindow.push(e.defaultPrevented)
      e.preventDefault()
    }, { once: true })

    fireEvent.click(link, { [modifier]: true })

    expect(preventedBeforeWindow).toEqual([false])
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
