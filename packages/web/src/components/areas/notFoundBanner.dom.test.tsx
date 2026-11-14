// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderInApp } from '../../test/renderInApp'
import userEvent from '@testing-library/user-event'
import { NotFoundBanner } from './NotFoundBanner'

it('reports the unresolved link as an alert', () => {
  renderInApp(<NotFoundBanner notFound={{ param: 'flow', value: 'retired' }} onDismiss={() => {}} />)

  expect(screen.getByRole('alert').textContent).toContain('No flow named retired')
})

it('dismisses from its button', async () => {
  const onDismiss = vi.fn()
  renderInApp(<NotFoundBanner notFound={{ param: 'flow', value: 'retired' }} onDismiss={onDismiss} />)

  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

  expect(onDismiss).toHaveBeenCalledOnce()
})
