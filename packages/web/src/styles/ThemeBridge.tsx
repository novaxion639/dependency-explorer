import type { CSSProperties, ReactNode } from 'react'
import { ThemeProvider, type Theme } from '@mui/material/styles'
import { useTheme } from '@skelloapp/skello-ds-web'

function px(value: CSSProperties['fontSize'], what: string): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n)) {
    throw new Error(`DS typography variant has no numeric ${what}`)
  }
  return n
}

const TYPE_SCALE = [
  ['textXs', '--text-xs'],
  ['textS', '--text-sm'],
  ['textM', '--text-md'],
  ['textL', '--text-lg'],
  ['headingS', '--text-xl'],
] as const

function themeVars(theme: Theme): Record<string, string> {
  const { palette, typography, shape, spacing } = theme
  return {
    '--paper': palette.background.default,
    '--paper-2': palette.skGrey[50],
    '--card': palette.background.paper,
    '--ink': palette.text.primary,
    '--ink-muted': palette.text.secondary,
    '--ink-faint': palette.text.secondary,
    '--rule': palette.divider,
    '--rule-strong': palette.skGrey[300],
    '--highlight': palette.upsell.light,
    '--fails': palette.error.main,
    '--starves': palette.warning.main,
    '--degrades': palette.warning.dark,
    '--ok': palette.success.main,
    '--font-sans': typography.fontFamily ?? 'sans-serif',
    ...Object.fromEntries(TYPE_SCALE.map(([variant, token]) => [token, `${px(typography[variant].fontSize, 'font size')}px`])),
    '--space-1': spacing(0.5),
    '--space-2': spacing(1),
    '--space-3': spacing(1.5),
    '--space-4': spacing(2),
    '--space-5': spacing(3),
    '--space-6': spacing(4),
    '--radius-sm': `${shape.borderRadiusXs}px`,
    '--radius-md': `${shape.borderRadiusXs}px`,
    '--radius-lg': `${shape.borderRadius}px`,
  }
}

function sizedByTokens(theme: Theme): Theme {
  const scaled = (variant: (typeof TYPE_SCALE)[number][0], token: string): CSSProperties => {
    const { fontSize, lineHeight } = theme.typography[variant]
    return { fontSize: `var(${token})`, lineHeight: px(lineHeight, 'line height') / px(fontSize, 'font size') }
  }
  return {
    ...theme,
    typography: {
      ...theme.typography,
      textXs: scaled('textXs', '--text-xs'),
      textS: scaled('textS', '--text-sm'),
      textM: scaled('textM', '--text-md'),
      textL: scaled('textL', '--text-lg'),
      headingS: scaled('headingS', '--text-xl'),
    },
  }
}

export function ThemeBridge({ children }: { children: ReactNode }) {
  const declarations = Object.entries(themeVars(useTheme())).map(([name, value]) => `${name}:${value}`)
  return (
    <>
      <style>{`:root{${declarations.join(';')}}`}</style>
      <ThemeProvider theme={sizedByTokens}>{children}</ThemeProvider>
    </>
  )
}
