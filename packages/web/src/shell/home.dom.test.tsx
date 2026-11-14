// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithNav } from '../test/renderWithNav'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('asks the question', () => {
    renderWithNav(<HomePage index={[]} />)

    expect(screen.getByRole('textbox', { name: 'What do you want to know?' })).toBeTruthy()
  })

  it.each([
    ['The monolith', '/?page=monolith'],
    ['The microservices', '/?page=microservices'],
    ['Key flows', '/?page=flows'],
    ['Change impact', '/?page=impact'],
  ])('links the %s tile to the top of its module', (title, href) => {
    renderWithNav(<HomePage index={[]} />)

    expect(screen.getByRole('link', { name: new RegExp(`^${title}`) }).getAttribute('href')).toBe(href)
  })
})
