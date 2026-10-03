export function inlineTokens(svg: string, read: (token: string) => string): string {
  return svg.replace(/var\((--[a-z0-9-]+)\)/g, (match, token: string) => read(token).trim() || match)
}

export function readRootToken(token: string): string {
  if (typeof document === 'undefined') {
    return ''
  }
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}
