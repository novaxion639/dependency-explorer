import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { AppProviders } from '../AppProviders'
import { parseUrl } from '../hooks/useUrlState'
import { NavContext } from '../shell/NavLink'

export function renderInApp(ui: ReactNode, qs = '') {
  const onNavigate = vi.fn()
  const url = parseUrl(qs)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders>
      <NavContext value={{ url, onNavigate }}>{children}</NavContext>
    </AppProviders>
  )
  return { onNavigate, ...render(ui, { wrapper }) }
}
