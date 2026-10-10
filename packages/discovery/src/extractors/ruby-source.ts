import { maskStrings, stripComments, type Read } from '../code-wiring'
import { singularize } from './rails-routes'
import { underscore } from './rails-schema'

export interface Span { name: string; line: number; body: string; raw: string }
export interface Declaration { text: string; line: number }

const STATEMENT_OPEN = /^\s*(?:(?:private|protected|public)\s+)?(?:def|class|module|if|unless|while|until|case|begin|for)\b|(?:[^=!<>]=|\|\|=|&&=)\s*(?:if|unless|case|begin)\b/
const LOOP_STATEMENT = /^\s*(?:while|until|for)\b/
const DO_BLOCK = /(?<![.:\w])do\b(?!:)/g
const END = /(?<![.:\w])end\b/g
const DEF = /^\s*(?:(?:private|protected|public)\s+)?def\s+(self\.)?(\w+[!?=]?)/
const SINGLETON = /^\s*class\s*<<\s*self\b/
const HEREDOC = /<<[~-]?(['"]?)([A-Z_]\w*)\1[^\n]*\n([\s\S]*?)^[ \t]*\2\b/gm

function maskHeredocs(code: string): string {
  return code.replace(HEREDOC, (whole: string, _quote: string, _tag: string, body: string) => whole.replace(body, body.replace(/[^\n]/g, ' ')))
}

export function rubyCode(source: string): string {
  return maskStrings(maskHeredocs(stripComments(source)))
}

function delta(line: string): number {
  const statementOpens = STATEMENT_OPEN.test(line) ? 1 : 0
  const blockOpens = LOOP_STATEMENT.test(line) ? 0 : (line.match(DO_BLOCK) ?? []).length
  return statementOpens + blockOpens - (line.match(END) ?? []).length
}

export function blockEnd(lines: string[], start: number): number {
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    depth += delta(lines[i] ?? '')
    if (depth <= 0) {
      return i
    }
  }
  return lines.length - 1
}

function singletonRanges(code: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  code.forEach((line, i) => {
    if (SINGLETON.test(line)) {
      out.push([i, blockEnd(code, i)])
    }
  })
  return out
}

export function methodSpans(source: string): Span[] {
  const raw = stripComments(source).split('\n')
  const code = rubyCode(source).split('\n')
  const singletons = singletonRanges(code)
  const spans: Span[] = []
  code.forEach((line, i) => {
    const m = DEF.exec(line)
    if (!m) {
      return
    }
    const end = blockEnd(code, i)
    const singleton = m[1] !== undefined || singletons.some(([from, to]) => i > from && i < to)
    spans.push({ name: `${singleton ? 'self.' : ''}${m[2] ?? ''}`, line: i + 1, body: code.slice(i, end + 1).join('\n'), raw: raw.slice(i, end + 1).join('\n') })
  })
  return spans
}

function continues(text: string): boolean {
  const t = text.trimEnd()
  const balance = (t.match(/[([{]/g) ?? []).length - (t.match(/[)\]}]/g) ?? []).length
  return t.endsWith(',') || t.endsWith('\\') || balance > 0
}

export function declarations(code: string, starts: RegExp): Declaration[] {
  const lines = code.split('\n')
  const out: Declaration[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!starts.test(lines[i] ?? '')) {
      continue
    }
    const line = i + 1
    let text = lines[i] ?? ''
    while (continues(text) && i + 1 < lines.length) {
      i += 1
      text = `${text} ${(lines[i] ?? '').trim()}`
    }
    out.push({ text, line })
  }
  return out
}

export function constantPath(constant: string): string {
  return `${constant.replace(/^::/, '').split('::').map(underscore).join('/')}.rb`
}

export function resolveConstant(constant: string, roots: readonly string[], read: Read): string | null {
  const rel = constantPath(constant)
  return roots.map(root => `${root}/${rel}`).find(file => read(file) !== null) ?? null
}

export function classify(word: string): string {
  return singularize(word).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}
