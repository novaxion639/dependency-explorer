// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderInApp } from '../../test/renderInApp'
import { ImpactPage } from './ImpactPage'

const noop = () => {}
const syncFilter = () => screen.getByRole('button', { name: 'Hard failures (sync)' })

describe('ImpactPage filter', () => {
  it('presses the sync filter', async () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    await userEvent.click(syncFilter())

    expect(syncFilter().getAttribute('aria-pressed')).toBe('true')
  })

  it.each(['degrades', 'starves'])('drops the %s effects under the sync filter', async effect => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    await userEvent.click(syncFilter())

    expect(screen.queryByText(effect)).toBeNull()
  })

  it('keeps the hard failures under the sync filter', async () => {
    renderInApp(<ImpactPage origin="svc-requests" onSelect={noop} onPick={noop} />)

    await userEvent.click(syncFilter())

    expect(screen.getAllByText('fails').length).toBeGreaterThan(0)
  })
})
