import type { ReactNode } from 'react'
import { StyledEngineProvider } from '@mui/material/styles'
import { SkThemeProvider } from '@skelloapp/skello-ds-web'
import { ThemeBridge } from './styles/ThemeBridge'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StyledEngineProvider injectFirst>
      <SkThemeProvider>
        <ThemeBridge>{children}</ThemeBridge>
      </SkThemeProvider>
    </StyledEngineProvider>
  )
}
