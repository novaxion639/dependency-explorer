import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Rail } from './Rail'

describe('Rail', () => {
  it('groups modules without adding a landmark per group', () => {
    const html = renderToStaticMarkup(<Rail page="flows" onNavigate={() => {}} />)
    expect(html).not.toContain('<section')
    expect(html.match(/role="group"/g)).toHaveLength(3)
  })
})
