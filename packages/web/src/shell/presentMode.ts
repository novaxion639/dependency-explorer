const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function presentKeyAction(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; targetTag: string; targetEditable: boolean },
  present: boolean,
): 'toggle' | 'exit' | null {
  if (FIELDS.has(e.targetTag) || e.targetEditable || e.metaKey || e.ctrlKey || e.altKey) {
    return null
  }
  if (e.key.toLowerCase() === 'p') {
    return 'toggle'
  }
  if (e.key === 'Escape' && present) {
    return 'exit'
  }
  return null
}
