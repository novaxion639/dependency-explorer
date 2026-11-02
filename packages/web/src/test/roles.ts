const IMPLICIT_ROLE: Record<string, string> = { A: 'link', H1: 'heading', H2: 'heading', H3: 'heading', LI: 'listitem', UL: 'list' }

function roleOf(el: Element): string | undefined {
  const explicit = el.getAttribute('role')
  if (explicit !== null) {
    return explicit
  }
  if (el.tagName === 'SECTION') {
    return el.hasAttribute('aria-label') ? 'region' : undefined
  }
  return IMPLICIT_ROLE[el.tagName]
}

const nameOf = (el: Element): string => el.getAttribute('aria-label') ?? el.textContent ?? ''

const matches = (value: string, name: string | RegExp): boolean => (typeof name === 'string' ? value === name : name.test(value))

export const allByRole = (root: ParentNode, role: string, name?: string | RegExp): Element[] =>
  [...root.querySelectorAll('*')].filter(el => roleOf(el) === role && (name === undefined || matches(nameOf(el), name)))

export const byRole = (root: ParentNode, role: string, name?: string | RegExp): Element | null => allByRole(root, role, name).at(0) ?? null

export const byText = (root: ParentNode, text: RegExp): Element | null =>
  [...root.querySelectorAll('*')].filter(el => text.test(el.textContent ?? '')).at(-1) ?? null
