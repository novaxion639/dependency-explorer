import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { parseUrl } from '../hooks/useUrlState'
import { NavContext } from '../shell/NavLink'

export function renderWithNav(ui: ReactNode, qs = '') {
  const onNavigate = vi.fn()
  render(<NavContext value={{ url: parseUrl(qs), onNavigate }}>{ui}</NavContext>)
  return { onNavigate }
}
