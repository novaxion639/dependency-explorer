const DECLARATION = /^(?:export\s+)?const\s+(\w+)[^=\n]*=\s*/gm
const NEW_CLASS = /\bnew\s+([A-Z]\w*)/g
const CONSTRUCTED = /^new\s+([A-Z]\w*)/
const IDENTIFIER = /\b[A-Za-z_$][\w$]*\b/g
const NOT_INJECTABLE = new Set(['Map', 'Set', 'Array', 'Object', 'Date', 'Promise', 'URL', 'Error'])

function statementEnd(source: string, from: number, limit: number): number {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const ch = source[i]
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
    } else if (ch === ';' && depth === 0) {
      return i
    }
  }
  return limit
}

function newClasses(code: string): string[] {
  return [...code.matchAll(NEW_CLASS)].map(m => m[1] ?? '').filter(c => !NOT_INJECTABLE.has(c))
}

function constructedClass(init: string): string | null {
  const head = CONSTRUCTED.exec(init)?.[1]
  return head && !NOT_INJECTABLE.has(head) ? head : null
}

export function parseInjections(source: string): Map<string, Set<string>> {
  const starts = [...source.matchAll(DECLARATION)]
  const decls = new Map(starts.map((m, i) => {
    const from = (m.index ?? 0) + m[0].length
    return [m[1] ?? '', source.slice(from, statementEnd(source, from, starts[i + 1]?.index ?? source.length))]
  }))
  const refsIn = (code: string, self: string) => [...new Set(code.match(IDENTIFIER) ?? [])].filter(id => id !== self && decls.has(id))
  const holds = (name: string, seen: Set<string>): string[] => {
    const init = decls.get(name)
    if (init === undefined || seen.has(name)) {
      return []
    }
    const ctor = constructedClass(init)
    return ctor ? [ctor] : [...newClasses(init), ...refsIn(init, name).flatMap(r => holds(r, new Set([...seen, name])))]
  }
  const out = new Map<string, Set<string>>()
  for (const [name, init] of decls) {
    const ctor = constructedClass(init)
    if (!ctor) {
      continue
    }
    const args = init.replace(CONSTRUCTED, '')
    const injected = [...newClasses(args), ...refsIn(args, name).flatMap(r => holds(r, new Set([name])))]
    out.set(ctor, new Set([...(out.get(ctor) ?? []), ...injected]))
  }
  return out
}

export function injectionReach(injects: Map<string, Set<string>>, from: string[], to: string[]): boolean {
  const targets = new Set(to)
  const firstHop = from.flatMap(c => [...(injects.get(c) ?? [])])
  return firstHop.some(c => targets.has(c) || [...(injects.get(c) ?? [])].some(d => targets.has(d)))
}
