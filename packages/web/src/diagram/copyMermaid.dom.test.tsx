// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderInApp } from '../test/renderInApp'
import { CopyMermaid } from './CopyMermaid'

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

const refuse = async () => {
  throw new Error('denied')
}

describe('CopyMermaid', () => {
  it('confirms a copy', async () => {
    stubClipboard(async () => {})
    renderInApp(<CopyMermaid source="flowchart LR" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy Mermaid' }))

    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('resets when the diagram changes', async () => {
    stubClipboard(async () => {})
    const { rerender } = renderInApp(<CopyMermaid source="flowchart LR" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy Mermaid' }))

    rerender(<CopyMermaid source="flowchart TB" />)

    expect(screen.getByRole('button', { name: 'Copy Mermaid' })).toBeTruthy()
  })

  it('reports a refused clipboard write', async () => {
    stubClipboard(refuse)
    renderInApp(<CopyMermaid source="flowchart LR" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy Mermaid' }))

    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy()
  })
})
