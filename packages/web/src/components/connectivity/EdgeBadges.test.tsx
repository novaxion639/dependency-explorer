import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EdgeBadges } from './EdgeBadges'

describe('EdgeBadges grade', () => {
  it.each([
    ['graph', '✓', 'verified in the call graph at the pinned commit — graph'],
    ['import', '✓', 'verified in the call graph at the pinned commit — import'],
    ['text', '~', 'name match only — unverified'],
    ['none', '✗', 'no evidence in code'],
  ] as const)('renders %s as %s with its title', (grade, symbol, title) => {
    const html = renderToStaticMarkup(<EdgeBadges data={{ grade }} />)
    expect(html).toContain(`title="${title}"`)
    expect(html).toContain(`>${symbol}</span>`)
  })

  it('renders no grade badge for an ungraded edge', () => {
    expect(renderToStaticMarkup(<EdgeBadges data={{}} />)).toBe('')
  })
})
