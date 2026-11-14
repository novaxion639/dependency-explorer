// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderInApp } from '../test/renderInApp'
import { NO_FOCUS } from './focus'
import type { DiagramModel, Renderer } from './model'
import { Diagram } from './Diagram'

const model = (renderers: Renderer[]): DiagramModel => ({
  id: 'm', title: 'A diagram', width: 300, height: 100, renderers, groups: [], edges: [],
  nodes: [{ id: 'a', kind: 'service', label: 'svc-a', detail: [], stores: [], fontSize: 12, x: 10, y: 10, w: 120, h: 29 }],
})
const noop = () => {}
const render = (renderers: Renderer[], renderer: Renderer) => renderInApp(
  <Diagram model={model(renderers)} focus={NO_FOCUS} renderer={renderer} onRenderer={noop} onSelect={noop} filename="m" notes={['a note']} />,
)
const renderers = () => within(screen.getByRole('group', { name: 'Renderer' })).getAllByRole('button')

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Diagram', () => {
  it('offers every renderer the model supports', () => {
    render(['react-flow', 'svg'], 'svg')

    expect(renderers().map(b => b.textContent)).toEqual(['React Flow', 'SVG'])
  })

  it('marks the active renderer pressed', () => {
    render(['react-flow', 'svg'], 'svg')

    expect(screen.getByRole('button', { name: 'SVG', pressed: true })).toBeTruthy()
  })

  it.each(['Export PNG', 'Export SVG'])('offers %s on the SVG renderer', name => {
    render(['react-flow', 'svg'], 'svg')

    expect(screen.getByRole('button', { name })).toBeTruthy()
  })

  it('names the diagram region after the model', () => {
    render(['svg'], 'svg')

    expect(screen.getByRole('region', { name: 'A diagram' })).toBeTruthy()
  })

  it('falls back to React Flow when the model does not support the renderer', () => {
    render(['react-flow'], 'svg')

    expect(screen.getByRole('button', { name: 'React Flow', pressed: true })).toBeTruthy()
  })

  it.each<Renderer>(['react-flow', 'svg'])('offers the Mermaid source on the %s renderer', renderer => {
    render(['react-flow', 'svg'], renderer)

    expect(screen.getByRole('button', { name: 'Copy Mermaid' })).toBeTruthy()
  })

  it.each(['sync', 'async', 'data feed', 'thicker = more connections', 'a note'])('explains %s in the legend', text => {
    render(['svg'], 'svg')

    expect(within(screen.getByRole('list', { name: 'Legend' })).getByText(text)).toBeTruthy()
  })
})
