// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { enteredNodeId } from './nodeKey'

describe('enteredNodeId', () => {
  it('returns the id of the node the Enter key was pressed in', () => {
    const node = document.createElement('div')
    node.className = 'react-flow__node'
    node.setAttribute('data-id', 'u:cu-create-service')
    const label = document.createElement('span')
    node.append(label)
    expect(enteredNodeId('Enter', label)).toBe('u:cu-create-service')
    expect(enteredNodeId('a', label)).toBeNull()
    expect(enteredNodeId('Enter', document.body)).toBeNull()
  })
})
