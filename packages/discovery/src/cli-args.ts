export const unknownFlags = (argv: string[], known: readonly string[]): string[] =>
  argv.filter(arg => arg.startsWith('--') && arg !== '--' && !known.includes(arg))
