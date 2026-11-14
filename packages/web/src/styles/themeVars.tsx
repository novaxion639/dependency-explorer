import { useTheme, type Theme } from '@skelloapp/skello-ds-web'
import type { CSSProperties } from 'react'

function size(variant: CSSProperties): string {
  const { fontSize } = variant
  if (typeof fontSize === 'number') {
    return `${fontSize}px`
  }
  if (typeof fontSize === 'string') {
    return fontSize
  }
  throw new Error('DS typography variant has no font size')
}

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
    '--text-xs': size(typography.textXs),
    '--text-sm': size(typography.textS),
    '--text-md': size(typography.textM),
    '--text-lg': size(typography.textL),
    '--text-xl': size(typography.headingS),
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

export function ThemeVars() {
  const declarations = Object.entries(themeVars(useTheme())).map(([name, value]) => `${name}:${value}`)
  return <style>{`:root{${declarations.join(';')}}`}</style>
}
