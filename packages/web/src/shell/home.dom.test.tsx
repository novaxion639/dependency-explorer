// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { parseUrl } from '../hooks/useUrlState'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('asks the question', () => {
    render(<HomePage url={parseUrl('')} index={[]} onNavigate={() => {}} />)

    expect(screen.getByRole('textbox', { name: 'What do you want to know?' })).toBeTruthy()
  })

  it.each([
    ['The monolith', '/?page=monolith'],
    ['The microservices', '/?page=microservices'],
    ['Key flows', '/?page=flows'],
    ['Change impact', '/?page=impact'],
  ])('links the %s tile to the top of its module', (title, href) => {
    render(<HomePage url={parseUrl('')} index={[]} onNavigate={() => {}} />)

    expect(screen.getByRole('link', { name: new RegExp(`^${title}`) }).getAttribute('href')).toBe(href)
  })
})
