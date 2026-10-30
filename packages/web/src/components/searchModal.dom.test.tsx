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
  it('is an open dialog holding a combobox over a listbox, and gives focus back on close', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    Element.prototype.scrollIntoView = () => {}
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
      this.querySelector('input')?.focus()
    }
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<SearchModal index={searchIndex} onNavigate={() => {}} onClose={() => {}} />))
    expect(host.querySelector('dialog')?.open).toBe(true)
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
    await act(async () => root.unmount())
    expect(document.activeElement).toBe(opener)
  })
  it('names listeners and jobs among the kinds it searches', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<SearchModal index={searchIndex} onNavigate={() => {}} onClose={() => {}} />))
    expect(host.textContent).toMatch(/listeners and jobs/)
    await act(async () => root.unmount())
  })
})
