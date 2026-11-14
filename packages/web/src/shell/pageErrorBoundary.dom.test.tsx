// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderInApp } from '../test/renderInApp'
import { PageErrorBoundary } from './PageErrorBoundary'

function Broken(): never {
  throw new Error('row 42 has no owner')
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PageErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    renderInApp(<PageErrorBoundary resetKey="a" onHome={() => {}}><p>page</p></PageErrorBoundary>)

    expect(screen.getByText('page')).toBeTruthy()
  })

  it('replaces a view that throws with an error alert naming the cause', () => {
    renderInApp(<PageErrorBoundary resetKey="a" onHome={() => {}}><Broken /></PageErrorBoundary>)

    expect(screen.getByRole('alert').textContent).toContain('This view failed to render')
    expect(screen.getByRole('alert').textContent).toContain('row 42 has no owner')
  })

  it('offers a way home', async () => {
    const onHome = vi.fn()
    renderInApp(<PageErrorBoundary resetKey="a" onHome={onHome}><Broken /></PageErrorBoundary>)

    await userEvent.click(screen.getByRole('button', { name: 'Go home' }))

    expect(onHome).toHaveBeenCalledOnce()
  })

  it('recovers when the URL changes', () => {
    const { rerender } = renderInApp(<PageErrorBoundary resetKey="a" onHome={() => {}}><Broken /></PageErrorBoundary>)

    rerender(<PageErrorBoundary resetKey="b" onHome={() => {}}><p>next page</p></PageErrorBoundary>)

    expect(screen.getByText('next page')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the error while the URL stays the same', () => {
    const { rerender } = renderInApp(<PageErrorBoundary resetKey="a" onHome={() => {}}><Broken /></PageErrorBoundary>)

    rerender(<PageErrorBoundary resetKey="a" onHome={() => {}}><p>next page</p></PageErrorBoundary>)

    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
