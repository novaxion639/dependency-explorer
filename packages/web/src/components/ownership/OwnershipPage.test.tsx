import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { connectivityMap } from '@dependency-explorer/data'
import { OwnershipPage } from './OwnershipPage'

it('lists every team and keeps colours out of inline styles', () => {
  const html = renderToStaticMarkup(<OwnershipPage map={connectivityMap} focusedTeam={null} onFocusTeam={() => {}} onSelectService={() => {}} onOpenArea={() => {}} />)
  for (const team of connectivityMap.teams ?? []) {
    expect(html, team.id).toContain(team.name)
  }
  expect(html).not.toMatch(/style="[^"]*(#[0-9a-fA-F]{3,8}|rgba?\()/)
})
