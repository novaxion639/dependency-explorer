// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { enteredNodeId } from './nodeKey'

function node(id: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'react-flow__node'
  el.setAttribute('data-id', id)
  return el
}

describe('enteredNodeId', () => {
  it('returns the id of the node the Enter key was pressed on', () => {
    const el = node('u:cu-create-service')
    expect(enteredNodeId('Enter', el)).toBe('u:cu-create-service')
    expect(enteredNodeId('a', el)).toBeNull()
    expect(enteredNodeId('Enter', document.body)).toBeNull()
  })

  it('leaves Enter on a control inside the node to that control', () => {
    const el = node('s:svc-shifts')
    const chip = document.createElement('button')
    el.append(chip)
    expect(enteredNodeId('Enter', chip)).toBeNull()
  })
})
