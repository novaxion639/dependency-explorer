const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export interface KeyInfo { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; targetTag: string; targetEditable: boolean }

export function keyInfo(e: KeyboardEvent): KeyInfo {
  const target = e.target instanceof HTMLElement ? e.target : null
  return { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, targetTag: target?.tagName ?? '', targetEditable: target?.isContentEditable ?? false }
}

export function presentKeyAction(e: KeyInfo, present: boolean): 'toggle' | 'exit' | null {
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

export function onPresentKey(
  e: Parameters<typeof presentKeyAction>[0] & { stopPropagation: () => void },
  present: boolean,
  patch: (p: { present: boolean }) => void,
): void {
  const action = presentKeyAction(e, present)
  if (action === 'toggle') {
    patch({ present: !present })
  }
  if (action === 'exit') {
    e.stopPropagation()
    patch({ present: false })
  }
}

const STEP: Record<string, 'next' | 'prev'> = { ArrowRight: 'next', ArrowDown: 'next', ArrowLeft: 'prev', ArrowUp: 'prev' }

export function presentStepKey(e: KeyInfo): 'next' | 'prev' | null {
  if (FIELDS.has(e.targetTag) || e.targetEditable || e.metaKey || e.ctrlKey || e.altKey) {
    return null
  }
  return STEP[e.key] ?? null
}

export function stepThrough(ids: readonly string[], current: string | null, dir: 'next' | 'prev'): string | null {
  const at = current ? ids.indexOf(current) : -1
  if (at < 0) {
    return (dir === 'next' ? ids[0] : ids[ids.length - 1]) ?? null
  }
  return ids[(at + (dir === 'next' ? 1 : ids.length - 1)) % ids.length] ?? null
}
