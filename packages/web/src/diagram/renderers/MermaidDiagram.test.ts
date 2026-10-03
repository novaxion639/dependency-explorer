import { describe, it, expect } from 'vitest'
import { renderedSvg } from './MermaidDiagram'

describe('renderedSvg', () => {
  it('hands out only the render of the current source', () => {
    expect(renderedSvg({ source: 'flowchart LR\n a', svg: '<svg/>' }, 'flowchart LR\n a')).toBe('<svg/>')
    expect(renderedSvg({ source: 'flowchart LR\n a', svg: '<svg/>' }, 'flowchart LR\n b')).toBeNull()
    expect(renderedSvg(null, 'flowchart LR\n a')).toBeNull()
  })
})
