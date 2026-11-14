import { createContext, use, type MouseEvent, type ReactNode } from 'react'
import { SkChip, SkLink, type SkLinkProps } from '@skelloapp/skello-ds-web'
import type { SxProps, Theme } from '@mui/material/styles'
import { applyPatch, hrefFor, type UrlState } from '../hooks/useUrlState'

interface Nav {
  url: UrlState
  onNavigate: (patch: Partial<UrlState>, opts?: { push?: boolean }) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const nav = use(NavContext)
  if (!nav) {
    throw new Error('a link rendered outside NavContext')
  }
  return nav
}

interface Props {
  patch: Partial<UrlState>
  push?: boolean
  onFollow?: () => void
  className?: string
  color?: SkLinkProps['color']
  underline?: SkLinkProps['underline']
  'aria-current'?: 'page'
  children: ReactNode
}

const BASE = import.meta.env.BASE_URL

const opensElsewhere = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

function useNavTarget(patch: Partial<UrlState>, push?: boolean, onFollow?: () => void) {
  const { url, onNavigate } = useNav()
  return {
    href: hrefFor(applyPatch(url, patch), BASE),
    onClick: (e: MouseEvent) => {
      if (opensElsewhere(e)) {
        return
      }
      e.preventDefault()
      onNavigate(patch, push ? { push } : undefined)
      onFollow?.()
    },
  }
}

export function NavLink({ patch, push, onFollow, className, color, underline = 'hover', 'aria-current': current, children }: Props) {
  return (
    <SkLink {...useNavTarget(patch, push, onFollow)} className={className} color={color} underline={underline} aria-current={current}>
      {children}
    </SkLink>
  )
}

export function NavChip({ patch, label, title, sx }: { patch: Partial<UrlState>; label: string; title?: string; sx?: SxProps<Theme> }) {
  return <SkChip {...useNavTarget(patch)} component="a" clickable size="small" variant="outlined" label={label} title={title} sx={sx} />
}
