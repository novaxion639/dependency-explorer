// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { searchIndex } from '../shell/dataIndexes'
import { SearchModal } from './SearchModal'

function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('SearchModal', () => {
  it('is a modal combobox over a listbox, and gives focus back on close', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    Element.prototype.scrollIntoView = () => {}
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<SearchModal index={searchIndex} onNavigate={() => {}} onClose={() => {}} />))
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true')
    const input = host.querySelector<HTMLInputElement>('[role="combobox"]')
    if (!input) {
      throw new Error('no combobox')
    }
    expect(document.activeElement).toBe(input)
    await act(async () => type(input, 'svc-punch'))
    const listbox = host.querySelector('[role="listbox"]')
    expect(input.getAttribute('aria-controls')).toBe(listbox?.id)
    const first = listbox?.querySelector('[role="option"]')
    expect(input.getAttribute('aria-activedescendant')).toBe(first?.id)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    await act(async () => input.dispatchEvent(tab))
    expect(tab.defaultPrevented).toBe(true)
    await act(async () => root.unmount())
    expect(document.activeElement).toBe(opener)
  })
})
