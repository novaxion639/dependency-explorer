import { escapeRegExp, importedFiles, loadWiring, maskStrings, readerFor, stripComments, type Alias, type Read } from './code-wiring'

export interface SourceState {
  name: string
  type: string
  next?: string
  end: boolean
  default?: string
  choiceNexts: string[]
  catchNexts: string[]
  maxConcurrency?: number
  lambdaKey?: string
  states: SourceState[]
  startAt?: string
  branchStarts: string[]
}

export interface SourceMachine { startAt: string; states: SourceState[]; unresolved: string[] }

export interface Text { src: string; masked: string }

type Entry =
  | { kind: 'object'; name: string; open: number; close: number }
  | { kind: 'unread'; text: string }
  | { kind: 'spread'; callee: string; args: string[] }
  | { kind: 'value'; name: string; start: number; end: number }

interface Context { file: string; aliases: Alias[]; read: Read; unresolved: string[] }

const OPENERS = new Set(['{', '[', '('])
const CLOSERS = new Set(['}', ']', ')'])
const QUOTED = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/
const NEXT = /\bNext\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
const LAMBDA_KEY = [/formattedLambdaName(?:V2026)?\(\s*['"](\w+)['"]\s*\)/, /['"]Fn::GetAtt['"]\s*:\s*\[\s*['"](\w+?)(?:LambdaFunction)?['"]/]

function unescape(s: string): string {
  return s.replace(/\\(.)/g, '$1')
}

export function textOf(raw: string): Text {
  const src = stripComments(raw)
  return { src, masked: maskStrings(src) }
}

export function closer(t: Text, open: number): number {
  let depth = 0
  for (let i = open; i < t.masked.length; i++) {
    const c = t.masked[i] ?? ''
    if (OPENERS.has(c)) {
      depth++
    } else if (CLOSERS.has(c)) {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return t.masked.length
}

function skipBlank(t: Text, from: number, to: number): number {
  let i = from
  while (i < to && /[\s,]/.test(t.masked[i] ?? '')) {
    i++
  }
  return i
}

function valueEnd(t: Text, from: number, to: number): number {
  let i = from
  while (i < to && t.masked[i] !== ',') {
    i = OPENERS.has(t.masked[i] ?? '') ? closer(t, i) + 1 : i + 1
  }
  return Math.min(i, to)
}

function keyAt(t: Text, at: number): { name: string; end: number } | null {
  const quoted = /^(['"])((?:\\.|(?!\1)[^\\])*)\1/.exec(t.src.slice(at))
  if (quoted) {
    return { name: unescape(quoted[2] ?? ''), end: at + quoted[0].length }
  }
  if (t.src[at] === '[') {
    const close = closer(t, at)
    const expr = t.src.slice(at + 1, close).trim()
    const literal = QUOTED.exec(expr)?.[2]
    return { name: literal === undefined ? expr : unescape(literal), end: close + 1 }
  }
  const ident = /^[\w$]+/.exec(t.src.slice(at))
  return ident ? { name: ident[0], end: at + ident[0].length } : null
}

function entries(t: Text, open: number, close: number): Entry[] {
  const found: Entry[] = []
  let at = skipBlank(t, open + 1, close)
  while (at < close) {
    const spread = /^\.\.\.\s*([\w$]+)\s*\(/.exec(t.src.slice(at))
    if (spread) {
      const paren = at + spread[0].length - 1
      const end = closer(t, paren)
      const args = [...t.src.slice(paren + 1, end).matchAll(/(['"`])([^'"`]*)\1/g)].map(m => m[2] ?? '')
      found.push({ kind: 'spread', callee: spread[1] ?? '', args })
      at = skipBlank(t, end + 1, close)
      continue
    }
    if (t.src.startsWith('...', at)) {
      const end = valueEnd(t, at, close)
      found.push({ kind: 'unread', text: t.src.slice(at, end).trim() })
      at = skipBlank(t, end, close)
      continue
    }
    const key = keyAt(t, at)
    if (!key) {
      at = skipBlank(t, valueEnd(t, at, close), close)
      continue
    }
    const colon = /^\s*:\s*/.exec(t.src.slice(key.end))
    if (!colon) {
      at = skipBlank(t, valueEnd(t, key.end, close), close)
      continue
    }
    const start = key.end + colon[0].length
    if (t.masked[start] === '{') {
      const end = closer(t, start)
      found.push({ kind: 'object', name: key.name, open: start, close: end })
      at = skipBlank(t, end + 1, close)
    } else {
      const end = valueEnd(t, start, close)
      found.push({ kind: 'value', name: key.name, start, end })
      at = skipBlank(t, end, close)
    }
  }
  return found
}

function raw(t: Text, list: Entry[], name: string): string | undefined {
  const e = list.find(x => x.kind === 'value' && x.name === name)
  return e?.kind === 'value' ? t.src.slice(e.start, e.end).trim() : undefined
}

function str(t: Text, list: Entry[], name: string): string | undefined {
  const value = raw(t, list, name)
  const literal = value === undefined ? undefined : QUOTED.exec(value)?.[2]
  return literal === undefined ? undefined : unescape(literal)
}

function object(list: Entry[], name: string): { open: number; close: number } | undefined {
  const e = list.find(x => x.kind === 'object' && x.name === name)
  return e?.kind === 'object' ? e : undefined
}

function arrayObjects(t: Text, list: Entry[], name: string): Array<{ open: number; close: number }> {
  const e = list.find(x => x.kind === 'value' && x.name === name)
  if (e?.kind !== 'value' || t.masked[e.start] !== '[') {
    return []
  }
  const end = closer(t, e.start)
  const found: Array<{ open: number; close: number }> = []
  for (let i = e.start + 1; i < end; i++) {
    if (t.masked[i] === '{') {
      const close = closer(t, i)
      found.push({ open: i, close })
      i = close
    }
  }
  return found
}

function nexts(text: string): string[] {
  return [...text.matchAll(NEXT)].map(m => unescape(m[2] ?? ''))
}

function spreadCatches(t: Text, list: Entry[], ctx: Context): string[] {
  return list.flatMap(e => {
    if (e.kind !== 'spread') {
      return []
    }
    const helper = helperObject(e.callee, e.args, t, ctx)
    if (helper === null) {
      ctx.unresolved.push(e.callee)
      return []
    }
    return catchesIn(helper, entries(helper, 0, closer(helper, 0)))
  })
}

function catchesIn(t: Text, list: Entry[]): string[] {
  return arrayObjects(t, list, 'Catch').filter(c => t.src.slice(c.open, c.close).includes('States.ALL')).flatMap(c => nexts(t.src.slice(c.open, c.close)))
}

function stateOf(t: Text, name: string, open: number, close: number, ctx: Context): SourceState {
  const list = entries(t, open, close)
  const type = str(t, list, 'Type') ?? ''
  const body = t.src.slice(open, close)
  const concurrency = Number(raw(t, list, 'MaxConcurrency'))
  const processor = object(list, 'ItemProcessor') ?? object(list, 'Iterator')
  const processorEntries = processor ? entries(t, processor.open, processor.close) : []
  const processorStates = object(processorEntries, 'States')
  const branches = arrayObjects(t, list, 'Branches').map(b => {
    const inner = entries(t, b.open, b.close)
    const states = object(inner, 'States')
    return { start: str(t, inner, 'StartAt'), states: states ? statesIn(t, states.open, states.close, ctx) : [] }
  })
  return {
    name,
    type,
    next: str(t, list, 'Next'),
    end: raw(t, list, 'End') === 'true',
    default: str(t, list, 'Default'),
    choiceNexts: arrayObjects(t, list, 'Choices').flatMap(c => nexts(t.src.slice(c.open, c.close))),
    catchNexts: [...catchesIn(t, list), ...spreadCatches(t, list, ctx)],
    maxConcurrency: Number.isInteger(concurrency) ? concurrency : undefined,
    lambdaKey: type === 'Task' ? LAMBDA_KEY.map(r => r.exec(body)?.[1]).find(k => k !== undefined) : undefined,
    states: [...(processorStates ? statesIn(t, processorStates.open, processorStates.close, ctx) : []), ...branches.flatMap(b => b.states)],
    startAt: str(t, processorEntries, 'StartAt'),
    branchStarts: branches.flatMap(b => (b.start === undefined ? [] : [b.start])),
  }
}

function helperObject(callee: string, args: string[], t: Text, ctx: Context): Text | null {
  const definition = new RegExp(`(?:const|let|function)\\s+${escapeRegExp(callee)}\\b`)
  const candidates: Text[] = [t, ...importedFiles(t.src, ctx.file, ctx.aliases, ctx.read).flatMap(file => {
    const source = ctx.read(file)
    return source === null ? [] : [textOf(source)]
  })]
  for (const candidate of candidates) {
    const at = definition.exec(candidate.src)?.index
    if (at === undefined) {
      continue
    }
    const rest = candidate.src.slice(at)
    const params = (/^(?:const|let)\s+[\w$]+\s*=\s*\(([^)]*)\)/.exec(rest) ?? /^function\s+[\w$]+\s*\(([^)]*)\)/.exec(rest))?.[1] ?? ''
    const body = /=>\s*\(\s*\{|return\s*\{/.exec(rest)
    if (!body) {
      continue
    }
    const open = at + body.index + body[0].length - 1
    let objectText = candidate.src.slice(open, closer(candidate, open) + 1)
    params.split(',').map(p => p.trim()).filter(Boolean).forEach((param, i) => {
      const name = /^[\w$]+/.exec(param)?.[0] ?? ''
      const fallback = QUOTED.exec(param.split('=')[1]?.trim() ?? '')?.[2] ?? ''
      const arg = args[i] ?? fallback
      const id = escapeRegExp(name)
      objectText = objectText
        .split(`\${${name}}`).join(arg)
        .replace(new RegExp(`\\[\\s*${id}\\s*\\]`, 'g'), `'${arg}'`)
        .replace(new RegExp(`:\\s*${id}\\b(?!\\s*[:(.])`, 'g'), `: '${arg}'`)
    })
    return textOf(objectText)
  }
  return null
}

function statesIn(t: Text, open: number, close: number, ctx: Context): SourceState[] {
  return entries(t, open, close).flatMap(e => {
    if (e.kind === 'object') {
      return [stateOf(t, e.name, e.open, e.close, ctx)]
    }
    if (e.kind === 'spread') {
      const helper = helperObject(e.callee, e.args, t, ctx)
      if (helper === null) {
        ctx.unresolved.push(e.callee)
        return []
      }
      return statesIn(helper, 0, closer(helper, 0), ctx)
    }
    ctx.unresolved.push(e.kind === 'unread' ? e.text : e.name)
    return []
  })
}

export function readMachine(repoDir: string, file: string, machine: string): SourceMachine | null {
  const read = readerFor(repoDir)
  const source = read(file)
  if (source === null) {
    return null
  }
  const t = textOf(source)
  const key = new RegExp(`(?:^|[\\s,{(])(?:${escapeRegExp(machine)}|'${escapeRegExp(machine)}'|"${escapeRegExp(machine)}")\\s*:\\s*\\{`).exec(t.src)
  if (!key) {
    return null
  }
  const open = key.index + key[0].length - 1
  const top = entries(t, open, closer(t, open))
  const definition = object(top, 'definition')
  const def = definition ? entries(t, definition.open, definition.close) : top
  const states = object(def, 'States')
  const startAt = str(t, def, 'StartAt')
  if (!states || startAt === undefined) {
    return null
  }
  const ctx: Context = { file, aliases: loadWiring(repoDir).aliases, read, unresolved: [] }
  return { startAt, states: statesIn(t, states.open, states.close, ctx), unresolved: ctx.unresolved }
}
