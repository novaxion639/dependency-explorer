import { stripComments, type Read } from '../code-wiring'
import type { RailsModel } from './rails-schema'
import { blockEnd, declarations, methodSpans, resolveConstant, rubyCode, type Declaration, type Span } from './ruby-source'

export interface SpanAt extends Span { file: string }
export interface DeclarationAt extends Declaration { file: string }
export interface Segment { file: string; lines: string[]; from: number; to: number }
export interface ModelEntry { className: string; table: string; file: string; modules: string[]; methods: Map<string, SpanAt>; segments: Segment[] }

export const MODULE_ROOTS = ['app/models/concerns', 'app/models', 'lib']
const INCLUDE = /^\s*include\s+((?:[\w:]+\s*,\s*)*[\w:]+)\s*$/
const INCLUDED_BLOCK = /^\s*included\s+do\b/

interface SourceFile { file: string; source: string }

function includedModules(source: string, read: Read, seen: Set<string>): SourceFile[] {
  const out: SourceFile[] = []
  for (const line of rubyCode(source).split('\n')) {
    const constants = (INCLUDE.exec(line)?.[1] ?? '').split(',').map(c => c.trim()).filter(c => c !== '')
    for (const constant of constants) {
      const file = resolveConstant(constant, MODULE_ROOTS, read)
      const moduleSource = file === null || seen.has(file) ? null : read(file)
      if (file !== null && moduleSource !== null) {
        seen.add(file)
        out.push(...includedModules(moduleSource, read, seen), { file, source: moduleSource })
      }
    }
  }
  return out
}

function includedSegments({ file, source }: SourceFile): Segment[] {
  const code = rubyCode(source).split('\n')
  const lines = stripComments(source).split('\n')
  const out: Segment[] = []
  code.forEach((line, i) => {
    if (INCLUDED_BLOCK.test(line)) {
      out.push({ file, lines, from: i + 1, to: blockEnd(code, i) - 1 })
    }
  })
  return out
}

export function buildModelIndex(models: RailsModel[], read: Read): ModelEntry[] {
  return models.flatMap(model => {
    const source = read(model.file)
    if (source === null) {
      return []
    }
    const modules = includedModules(source, read, new Set([model.file]))
    const methods = new Map<string, SpanAt>()
    for (const m of [...modules, { file: model.file, source }]) {
      for (const span of methodSpans(m.source)) {
        methods.set(span.name, { ...span, file: m.file })
      }
    }
    const lines = stripComments(source).split('\n')
    return [{
      className: model.className,
      table: model.table,
      file: model.file,
      modules: modules.map(m => m.file),
      methods,
      segments: [...modules.flatMap(includedSegments), { file: model.file, lines, from: 0, to: lines.length - 1 }],
    }]
  })
}

export function declarationsOf(entry: ModelEntry, starts: RegExp): DeclarationAt[] {
  return entry.segments.flatMap(seg => declarations(seg.lines.slice(seg.from, seg.to + 1).join('\n'), starts).map(d => ({ text: d.text, line: d.line + seg.from, file: seg.file })))
}
