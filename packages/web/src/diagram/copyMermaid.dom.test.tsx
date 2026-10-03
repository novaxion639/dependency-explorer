// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { CopyMermaid } from './CopyMermaid'

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

async function mount(source: string) {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<CopyMermaid source={source} />))
  const button = () => host.querySelector('button')
  return { root, button }
}

describe('CopyMermaid', () => {
  it('confirms a copy, and resets when the diagram changes', async () => {
    stubClipboard(async () => {})
    const { root, button } = await mount('flowchart LR')
    await act(async () => button()?.click())
    expect(button()?.textContent).toBe('Copied')
    await act(async () => root.render(<CopyMermaid source="flowchart TB" />))
    expect(button()?.textContent).toBe('Copy Mermaid')
    root.unmount()
  })
  it('reports a refused clipboard write', async () => {
    stubClipboard(async () => {
      throw new Error('denied')
    })
    const { root, button } = await mount('flowchart LR')
    await act(async () => button()?.click())
    expect(button()?.textContent).toBe('Copy failed')
    root.unmount()
  })
})
