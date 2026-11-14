// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderInApp } from '../test/renderInApp'
import { Diagram } from './Diagram'
import { NO_FOCUS } from './focus'
import { ALL_RENDERERS, type DiagramModel, type Renderer } from './model'

const model: DiagramModel = { id: 'm', title: 'Empty', width: 100, height: 100, nodes: [], groups: [], edges: [], renderers: ALL_RENDERERS }
const render = (renderer: Renderer, onRenderer: (renderer: Renderer) => void = () => {}) =>
  renderInApp(<Diagram model={model} focus={NO_FOCUS} renderer={renderer} onRenderer={onRenderer} onSelect={() => {}} filename="m" />)

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Diagram renderer switch', () => {
  it('keeps one tab stop for the group, on the pressed renderer', async () => {
    render('svg')

    await userEvent.tab()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'SVG', pressed: true }))
  })

  it('selects another renderer on click', async () => {
    const onRenderer = vi.fn()
    render('svg', onRenderer)

    await userEvent.click(screen.getByRole('button', { name: 'React Flow' }))

    expect(onRenderer).toHaveBeenCalledWith('react-flow')
  })

  it('moves focus with the arrow keys without selecting', async () => {
    const onRenderer = vi.fn()
    render('react-flow', onRenderer)
    await userEvent.tab()

    await userEvent.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'SVG' }))
    expect(onRenderer).not.toHaveBeenCalled()
  })

  it('selects the focused renderer with Enter', async () => {
    const onRenderer = vi.fn()
    render('react-flow', onRenderer)
    await userEvent.tab()

    await userEvent.keyboard('{ArrowRight}{Enter}')

    expect(onRenderer).toHaveBeenCalledWith('svg')
  })
})
