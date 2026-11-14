// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { pagePatch } from '../hooks/useUrlState'
import { renderInApp } from '../test/renderInApp'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb', () => {
  const crumbs = [{ label: 'Flows', patch: pagePatch('flows') }, { label: 'Shift Creation', patch: null }]

  it('links every crumb but the current page', () => {
    renderInApp(<Breadcrumb crumbs={crumbs} />, '?page=flows&flow=shift-creation')

    expect(screen.getByRole('link', { name: 'Flows' }).getAttribute('href')).toBe('/?page=flows')
    expect(screen.getByText('Shift Creation').getAttribute('aria-current')).toBe('page')
  })

  it('pushes a history entry for every crumb click', async () => {
    const { onNavigate } = renderInApp(<Breadcrumb crumbs={crumbs} />, '?page=flows&flow=shift-creation')

    await userEvent.click(screen.getByRole('link', { name: 'Flows' }))

    expect(onNavigate).toHaveBeenCalledWith(pagePatch('flows'), { push: true })
  })
})
