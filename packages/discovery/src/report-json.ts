const BUG_KEYED = new Set(['areaOfBug', 'teamsOfBug'])

export const reportJson = (report: unknown): string =>
  JSON.stringify(report, (key, value: unknown) => {
    if (BUG_KEYED.has(key)) {
      return undefined
    }
    return value instanceof Map ? Object.fromEntries(value) : value
  }, 2)
