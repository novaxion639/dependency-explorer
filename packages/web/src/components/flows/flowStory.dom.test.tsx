// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { FlowStory } from './FlowStory'

const chapters = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map(title => ({ title, summary: `${title} happens.`, refs: ['a'] }))

describe('FlowStory in the browser', () => {
  it('scrolls the selected chapter into view as the presenter steps', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.textContent ?? '')
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<FlowStory chapters={chapters} authored current={5} onSelect={() => {}}><p>diagram</p></FlowStory>))
    await act(async () => root.render(<FlowStory chapters={chapters} authored current={6} onSelect={() => {}}><p>diagram</p></FlowStory>))
    expect(scrolled).toEqual(['5FiveFive happens.', '6SixSix happens.'])
    root.unmount()
  })
})
