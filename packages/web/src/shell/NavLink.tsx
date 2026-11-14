import type { MouseEvent, ReactNode } from 'react'
import { applyPatch, hrefFor, type UrlState } from '../hooks/useUrlState'

interface Props {
  url: UrlState
  patch: Partial<UrlState>
  onNavigate: (patch: Partial<UrlState>, opts?: { push?: boolean }) => void
  push?: boolean
  className?: string
  'aria-current'?: 'page'
  children: ReactNode
}

const opensElsewhere = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

export function NavLink({ url, patch, onNavigate, push, className, 'aria-current': current, children }: Props) {
  return (
    <a
      href={hrefFor(applyPatch(url, patch), import.meta.env.BASE_URL)}
      className={className}
      aria-current={current}
      onClick={e => {
        if (opensElsewhere(e)) {
          return
        }
        e.preventDefault()
        onNavigate(patch, push ? { push } : undefined)
      }}
    >
      {children}
    </a>
  )
}
