// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Diagram } from './Diagram'
import { NO_FOCUS } from './focus'
import { ALL_RENDERERS, type DiagramModel, type Renderer } from './model'

const model: DiagramModel = { id: 'm', title: 'Empty', width: 100, height: 100, nodes: [], groups: [], edges: [], renderers: ALL_RENDERERS }

describe('Diagram renderer radios', () => {
  it('moves between renderers with the arrow keys, one tab stop for the group', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const picked: Renderer[] = []
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<Diagram model={model} focus={NO_FOCUS} renderer="svg" onRenderer={r => picked.push(r)} onSelect={() => {}} filename="m" />))
    const radios = [...host.querySelectorAll('[role="radio"]')]
    expect(radios.map(r => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1'])
    const group = host.querySelector('[role="radiogroup"]')
    await act(async () => group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    await act(async () => group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(picked).toEqual(['mermaid', 'react-flow'])
    root.unmount()
  })
})
