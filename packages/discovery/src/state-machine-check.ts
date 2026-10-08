import * as fs from 'node:fs'
import * as path from 'node:path'
import { allStates } from '@dependency-explorer/data'
import type { ConnectivityMap, MachineState } from '@dependency-explorer/schema'
import { escapeRegExp, loadWiring, readerFor, resolveSpecifier, type Alias, type Read } from './code-wiring'
import { closer, readMachine, textOf, type SourceState } from './state-machine-source'

export interface MachineFinding { flow: string; kind: 'state-machine-drift'; subject: string; detail: string }

const TYPES: Record<string, MachineState['type']> = { Task: 'task', Choice: 'choice', Map: 'map', Parallel: 'parallel', Pass: 'pass', Wait: 'wait' }
const TERMINAL = new Set(['Succeed', 'Fail'])
const HANDLER = /\bhandler\s*:\s*['"]([^'"]+)['"]/
const CONTAINER = 'src/container.ts'
const SUFFIXES = ['.ts', '.tsx', '/index.ts', '']

function tsFiles(dir: string, rel: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs.readdirSync(dir, { recursive: true, encoding: 'utf-8' }).filter(f => f.endsWith('.ts')).map(f => path.posix.join(rel, f))
}

function statementOf(source: string, name: string): string | null {
  const at = new RegExp(`export\\s+const\\s+${escapeRegExp(name)}\\b`).exec(source)?.index
  if (at === undefined) {
    return null
  }
  const next = source.indexOf('\nexport ', at + 1)
  return source.slice(at, next < 0 ? source.length : next)
}

function importSpec(source: string, cls: string): string | undefined {
  const c = escapeRegExp(cls)
  return new RegExp(`(?:import\\s*\\{[^}]*\\b${c}\\b[^}]*\\}\\s*from\\s*|\\{[^}]*\\b${c}\\b[^}]*\\}\\s*=\\s*await\\s+import\\(\\s*)['"]([^'"]+)['"]`).exec(source)?.[1]
}

function resolveFile(spec: string, from: string, aliases: Alias[], read: Read): string | null {
  const base = resolveSpecifier(spec, from, aliases)
  return base === null ? null : SUFFIXES.map(s => `${base}${s}`).find(f => read(f) !== null) ?? null
}

function classFile(statement: string, from: string, aliases: Alias[], read: Read): string | null {
  const container = read(CONTAINER) ?? ''
  const rank = (id: string) => (/handler$/i.test(id) ? 2 : /handler|job/i.test(id) ? 1 : 0)
  const ids = [...new Set(statement.match(/[A-Za-z_$][\w$]*/g) ?? [])].sort((a, b) => rank(b) - rank(a))
  for (const id of ids) {
    const declared = statementOf(container, id)
    const cls = declared === null ? undefined : /\bnew\s+([A-Z][\w$]*)\s*\(/.exec(declared)?.[1]
    const spec = cls === undefined || declared === null ? undefined : importSpec(declared, cls) ?? importSpec(container, cls)
    const file = spec === undefined ? null : resolveFile(spec, CONTAINER, aliases, read)
    if (file !== null) {
      return file
    }
  }
  const own = /\bnew\s+([A-Z][\w$]*)\s*\(/.exec(statement)?.[1]
  const spec = own === undefined ? undefined : importSpec(read(from) ?? '', own)
  return spec === undefined ? null : resolveFile(spec, from, aliases, read)
}

export function handlerFileOf(repoDir: string, lambdaKey: string): string | null {
  const read = readerFor(repoDir)
  const key = new RegExp(`(?:^|[\\s,{(])(?:${escapeRegExp(lambdaKey)}|'${escapeRegExp(lambdaKey)}'|"${escapeRegExp(lambdaKey)}")\\s*:\\s*\\{`)
  for (const file of ['serverless.ts', ...tsFiles(path.join(repoDir, 'serverless'), 'serverless')]) {
    const source = read(file)
    if (source === null) {
      continue
    }
    const t = textOf(source)
    const match = key.exec(t.src)
    if (!match) {
      continue
    }
    const open = match.index + match[0].length - 1
    const handler = HANDLER.exec(t.src.slice(open, closer(t, open)))?.[1]
    if (handler === undefined) {
      continue
    }
    const dot = handler.lastIndexOf('.')
    const module = handler.slice(0, dot)
    if (read(`${module}.py`) !== null) {
      return `${module}.py`
    }
    const moduleFile = `${module}.ts`
    const statement = statementOf(read(moduleFile) ?? '', handler.slice(dot + 1))
    return statement === null ? null : classFile(statement, moduleFile, loadWiring(repoDir).aliases, read)
  }
  return null
}

export function checkStateMachines(map: ConnectivityMap, repoBase: string) {
  const findings: MachineFinding[] = []
  const skipped = new Set<string>()
  let verified = 0
  for (const flow of map.flows) {
    const units = new Map((flow.codeUnits ?? []).map(u => [u.id, u]))
    for (const machine of flow.stateMachines ?? []) {
      const repoDir = path.join(repoBase, machine.service)
      if (!fs.existsSync(repoDir)) {
        skipped.add(machine.service)
        continue
      }
      const subject = `${flow.id}#${machine.id}`
      const report = (detail: string) => findings.push({ flow: flow.id, kind: 'state-machine-drift', subject, detail })
      const source = readMachine(repoDir, machine.file, machine.machine)
      if (source === null) {
        report(`definition ${machine.machine} not found in ${machine.file}`)
        continue
      }
      source.unresolved.forEach(name => report(`helper ${name} not resolved`))
      const names = new Map(allStates(machine).map(s => [s.id, s.name]))
      const nameOf = (id: string | undefined) => (id === undefined ? undefined : names.get(id) ?? id)
      const startName = nameOf(machine.start)
      if (source.startAt !== startName) {
        report(`start is ${source.startAt} in code, ${startName} authored`)
      }
      const compare = (authored: MachineState[], code: SourceState[]) => {
        const terminal = new Set(code.filter(s => TERMINAL.has(s.type)).map(s => s.name))
        for (const a of authored) {
          const before = findings.length
          const s = code.find(x => x.name === a.name)
          if (!s) {
            report(`${a.name}: authored, not in code`)
            continue
          }
          if (TYPES[s.type] !== a.type) {
            report(`${a.name}: type ${s.type} in code, ${a.type} authored`)
            continue
          }
          const next = nameOf(a.next)
          if (next !== undefined && s.next !== next) {
            report(`${a.name}: next ${s.next ?? 'none'} in code, ${next} authored`)
          }
          if (next === undefined && !s.end && !(s.next !== undefined && terminal.has(s.next)) && a.type !== 'choice') {
            report(`${a.name}: next ${s.next ?? 'none'} in code, none authored`)
          }
          if (a.type === 'choice') {
            const def = nameOf(a.default)
            if (s.default !== def) {
              report(`${a.name}: default ${s.default ?? 'none'} in code, ${def ?? 'none'} authored`)
            }
            const rules = (a.choices ?? []).map(c => nameOf(c.next) ?? '').sort().join(', ')
            if ([...s.choiceNexts].sort().join(', ') !== rules) {
              report(`${a.name}: choices ${s.choiceNexts.join(', ') || 'none'} in code, ${rules || 'none'} authored`)
            }
          }
          if (a.concurrency !== s.maxConcurrency && a.type === 'map') {
            report(`${a.name}: concurrency ${s.maxConcurrency ?? 'none'} in code, ${a.concurrency ?? 'none'} authored`)
          }
          const target = nameOf(a.catchTo ?? machine.errorHandler)
          const caught = s.catchNexts.join(', ') || 'nothing'
          if (a.catches && (target === undefined || !s.catchNexts.includes(target))) {
            report(`${a.name}: catches ${caught} in code, ${s.catchNexts.length > 0 && target !== undefined ? target : 'catches'} authored`)
          }
          if (!a.catches && s.catchNexts.length > 0) {
            report(`${a.name}: catches ${caught} in code, nothing authored`)
          }
          const unit = a.unit === undefined ? undefined : units.get(a.unit)
          if (a.type === 'task' && unit?.path !== undefined) {
            const file = s.lambdaKey === undefined ? null : handlerFileOf(repoDir, s.lambdaKey)
            if (file !== unit.path) {
              report(`${a.name}: handler ${file ?? 'unresolved'} in code, ${unit.path} authored`)
            }
          }
          if (a.type === 'map' && s.startAt !== a.states?.[0]?.name) {
            report(`${a.name}: item processor starts at ${s.startAt ?? 'none'} in code, ${a.states?.[0]?.name ?? 'none'} authored`)
          }
          if (a.type === 'parallel') {
            const branches = (a.branches ?? []).map(b => nameOf(b) ?? '').sort().join(', ')
            if ([...s.branchStarts].sort().join(', ') !== branches) {
              report(`${a.name}: branches ${s.branchStarts.join(', ') || 'none'} in code, ${branches || 'none'} authored`)
            }
          }
          if (a.states || s.states.length > 0) {
            compare(a.states ?? [], s.states)
          }
          if (findings.length === before) {
            verified++
          }
        }
        const authoredNames = new Set(authored.map(a => a.name))
        for (const s of code.filter(x => !TERMINAL.has(x.type) && !authoredNames.has(x.name))) {
          report(`${s.name}: in code, not authored`)
        }
      }
      compare(machine.states, source.states)
    }
  }
  return { findings, verified, skippedRepos: [...skipped].sort() }
}

