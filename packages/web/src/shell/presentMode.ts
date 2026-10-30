const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

type KeyPress = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'repeat' | 'defaultPrevented'> & { target: unknown }

function typingIn(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) {
    return false
  }
  return ('tagName' in target && typeof target.tagName === 'string' && FIELDS.has(target.tagName)) || ('isContentEditable' in target && target.isContentEditable === true)
}

export function presentKeyAction(e: KeyPress, present: boolean): 'toggle' | 'exit' | null {
  if (e.repeat || typingIn(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
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
  e: KeyPress & Pick<KeyboardEvent, 'stopPropagation'>,
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

export function presentStepKey(e: KeyPress): 'next' | 'prev' | null {
  if (e.defaultPrevented || typingIn(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
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
