import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotFoundBanner } from './NotFoundBanner'

it('reports the unresolved link as an alert with a dismiss button', () => {
  const html = renderToStaticMarkup(<NotFoundBanner notFound={{ param: 'flow', value: 'retired' }} onDismiss={() => {}} />)
  expect(html).toContain('role="alert"')
  expect(html).toContain('No flow named <code>retired</code>')
  expect(html).toMatch(/<button[^>]*>Dismiss<\/button>/)
  expect(html).not.toContain('style=')
})
