// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FlowStory } from './FlowStory'

const chapters = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map(title => ({ title, summary: `${title} happens.`, refs: ['a'] }))
const originalScroll = Element.prototype.scrollIntoView

afterEach(() => {
  Element.prototype.scrollIntoView = originalScroll
})

describe('FlowStory in the browser', () => {
  it('scrolls the selected chapter into view as the presenter steps', () => {
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.textContent ?? '')
    }
    const { rerender } = render(<FlowStory chapters={chapters} current={5} onSelect={() => {}}><p>diagram</p></FlowStory>)

    rerender(<FlowStory chapters={chapters} current={6} onSelect={() => {}}><p>diagram</p></FlowStory>)

    expect(scrolled).toEqual(['5FiveFive happens.', '6SixSix happens.'])
  })
})
