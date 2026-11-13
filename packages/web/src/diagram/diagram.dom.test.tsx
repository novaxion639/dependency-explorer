// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Diagram } from './Diagram'
import { NO_FOCUS } from './focus'
import { ALL_RENDERERS, type DiagramModel } from './model'

const model: DiagramModel = { id: 'm', title: 'Empty', width: 100, height: 100, nodes: [], groups: [], edges: [], renderers: ALL_RENDERERS }

describe('Diagram renderer radios', () => {
  it('keeps one tab stop for the group, on the checked renderer', () => {
    render(<Diagram model={model} focus={NO_FOCUS} renderer="svg" onRenderer={() => {}} onSelect={() => {}} filename="m" />)

    expect(screen.getAllByRole('radio').map(r => r.getAttribute('tabindex'))).toEqual(['-1', '0'])
  })

  it('moves between renderers with the arrow keys', async () => {
    const onRenderer = vi.fn()
    render(<Diagram model={model} focus={NO_FOCUS} renderer="svg" onRenderer={onRenderer} onSelect={() => {}} filename="m" />)
    screen.getByRole('radio', { name: 'SVG' }).focus()

    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')

    expect(onRenderer.mock.calls).toEqual([['react-flow'], ['react-flow']])
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'React Flow' }))
  })
})
