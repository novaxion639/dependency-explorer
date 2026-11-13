// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { pagePatch, parseUrl } from '../hooks/useUrlState'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb', () => {
  const crumbs = [{ label: 'Flows', patch: pagePatch('flows') }, { label: 'Shift Creation', patch: null }]

  it('links every crumb but the current page', () => {
    render(<Breadcrumb url={parseUrl('?page=flows&flow=shift-creation')} crumbs={crumbs} onNavigate={() => {}} />)

    expect(screen.getByRole('link', { name: 'Flows' }).getAttribute('href')).toBe('/?page=flows')
    expect(screen.getByText('Shift Creation').getAttribute('aria-current')).toBe('page')
  })

  it('pushes a history entry for every crumb click', async () => {
    const onNavigate = vi.fn()
    render(<Breadcrumb url={parseUrl('?page=flows&flow=shift-creation')} crumbs={crumbs} onNavigate={onNavigate} />)

    await userEvent.click(screen.getByRole('link', { name: 'Flows' }))

    expect(onNavigate).toHaveBeenCalledWith(pagePatch('flows'), { push: true })
  })
})
