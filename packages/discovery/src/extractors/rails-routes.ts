import * as fs from 'node:fs'
import * as path from 'node:path'

export interface RailsRoute { verb: string; path: string; controller: string; action: string; controllerFile: string }

interface Frame { path: string[]; module: string[]; controller: string | null; memberOf: string | null; methodScope: boolean }

const REST = {
  plural: [['GET', '', 'index'], ['POST', '', 'create'], ['GET', '/new', 'new'], ['GET', '/:id/edit', 'edit'], ['GET', '/:id', 'show'], ['PATCH', '/:id', 'update'], ['PUT', '/:id', 'update'], ['DELETE', '/:id', 'destroy']],
  singular: [['POST', '', 'create'], ['GET', '/new', 'new'], ['GET', '/edit', 'edit'], ['GET', '', 'show'], ['PATCH', '', 'update'], ['PUT', '', 'update'], ['DELETE', '', 'destroy']],
} as const

const OPENS_BLOCK = /\bdo\s*(\|[^|]*\|)?\s*$/
const OPENS_KEYWORD_BLOCK = /^(if|unless|case|begin|while|until)\b/
const IS_END = /^\s*end\b/
const CANONICAL_ACTIONS = new Set(['index', 'create', 'new', 'show', 'update', 'destroy'])
const ONE_LINE_BLOCK = /^(member|collection)\s*\{(.*)\}$/
const UNCOUNTED_STRINGS = /'[^']*'|"[^"]*"|\/[^/\s]+\//g
const IGNORED = /^(constraints|concern|draw|devise_for|Dir\.glob|\w+\s*=)/

function opt(line: string, key: string): string | null {
  const m = line.match(new RegExp(`\\b${key}:\\s*['":]([\\w/:.()*-]+)['"]?`))
  return m?.[1] ?? null
}

function list(line: string, key: string): Set<string> | null {
  const m = line.match(new RegExp(`\\b${key}:\\s*(?:%[iw]\\[([^\\]]*)\\]|\\[([^\\]]*)\\]|:(\\w+))`))
  if (!m) {
    return null
  }
  return new Set((m[1] ?? m[2] ?? m[3] ?? '').split(/[\s,]+/).map(s => s.replace(/^:|['"]/g, '')).filter(Boolean))
}

export function pluralize(word: string): string {
  if (/data$|s$/.test(word)) {
    return word
  }
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`
  }
  return /(ch|sh|x|z)$/.test(word) ? `${word}es` : `${word}s`
}

export function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`
  }
  if (/(ch|sh|x|z)es$/.test(word)) {
    return word.slice(0, -2)
  }
  return word.endsWith('s') ? word.slice(0, -1) : word
}

function join(parts: string[]): string {
  return `/${parts.flatMap(s => s.split('/')).filter(Boolean).join('/')}`
}

function onPath(f: Frame, on: string): string[] {
  if (!f.memberOf) {
    return f.path
  }
  if (on === 'member') {
    return [...f.path.slice(0, -1), f.memberOf]
  }
  return on === 'collection' ? f.path.slice(0, -1) : f.path
}

function openBrackets(line: string): number {
  const bare = line.replace(UNCOUNTED_STRINGS, '')
  return (bare.match(/[[({]/g) ?? []).length - (bare.match(/[\])}]/g) ?? []).length
}

function statements(content: string): string[] {
  const out: string[] = []
  let pending = ''
  for (const raw of content.split('\n')) {
    const line = raw.replace(/(^|\s)#(?!\{).*$/, '$1').trim()
    if (!line) {
      continue
    }
    pending = pending ? `${pending} ${line}` : line
    if (pending.endsWith(',') || pending.endsWith('\\') || openBrackets(pending) > 0) {
      continue
    }
    const oneLine = pending.match(ONE_LINE_BLOCK)
    out.push(...(oneLine ? [`${oneLine[1] ?? ''} do`, (oneLine[2] ?? '').trim(), 'end'] : [pending]))
    pending = ''
  }
  return out
}

export function parseRoutesContent(content: string): { routes: RailsRoute[]; unparsed: string[] } {
  const routes: RailsRoute[] = []
  const unparsed: string[] = []
  const root: Frame = { path: [], module: [], controller: null, memberOf: null, methodScope: false }
  const stack: Frame[] = [root]
  const top = (): Frame => stack[stack.length - 1] ?? root
  const emit = (verb: string, routePath: string[], controller: string, action: string, moduleParts: string[]) => {
    const fullController = [...moduleParts, controller].filter(Boolean).join('/')
    routes.push({ verb, path: join(routePath), controller: fullController, action, controllerFile: `app/controllers/${fullController}_controller.rb` })
  }

  for (const t of statements(content)) {
    if (/^Rails\.application\.routes\.draw/.test(t)) {
      continue
    }
    if (IS_END.test(t)) {
      if (stack.length > 1) {
        stack.pop()
      }
      continue
    }
    const f = top()
    const block = OPENS_BLOCK.test(t)

    const ns = t.match(/^namespace\s+:(\w+)/)
    if (ns) {
      const name = ns[1] ?? ''
      if (block) {
        stack.push({ path: [...f.path, opt(t, 'path') ?? name], module: [...f.module, opt(t, 'module') ?? name], controller: null, memberOf: null, methodScope: false })
      }
      continue
    }

    const scope = t.match(/^scope\b(?:\s*\(?\s*(?:['"]\/?([^'"]*)['"]|:(\w+)))?/)
    if (scope && block) {
      const p = scope[1] ?? scope[2] ?? opt(t, 'path')
      const m = opt(t, 'module')
      stack.push({ path: p ? [...f.path, p] : f.path, module: m ? [...f.module, m] : f.module, controller: opt(t, 'controller') ?? f.controller, memberOf: f.memberOf, methodScope: f.methodScope })
      continue
    }

    const scopeBlock = t.match(/^(member|collection)\s+do/)
    if (scopeBlock) {
      stack.push({ ...f, path: onPath(f, scopeBlock[1] ?? ''), memberOf: null, methodScope: true })
      continue
    }

    const res = t.match(/^(resources|resource)\s+:(\w+)/)
    if (res) {
      const singular = res[1] === 'resource'
      const name = res[2] ?? ''
      const seg = opt(t, 'path') ?? name
      const param = `:${opt(t, 'param') ?? 'id'}`
      const controller = opt(t, 'controller') ?? (singular ? pluralize(name) : name)
      const resModule = opt(t, 'module')
      const moduleParts = resModule ? [...f.module, resModule] : f.module
      const allowed = list(t, 'only')
      const excluded = list(t, 'except')
      for (const [verb, suffix, action] of singular ? REST.singular : REST.plural) {
        if ((!allowed || allowed.has(action)) && !excluded?.has(action)) {
          emit(verb, [...f.path, seg, suffix.replace(':id', param)], controller, action, moduleParts)
        }
      }
      if (block) {
        const nested = singular ? [...f.path, seg] : [...f.path, seg, `:${singularize(name)}_${param.slice(1)}`]
        stack.push({ path: nested, module: moduleParts, controller, memberOf: singular ? null : param, methodScope: singular })
      }
      continue
    }

    const verb = t.match(/^(get|post|put|patch|delete|match|root)\b\s*(.*)$/)
    if (verb) {
      const kind = verb[1] ?? ''
      const rest = verb[2] ?? ''
      const target = rest.match(/(?:to:|=>)\s*['"]([\w/]+)#(\w+)['"]/) ?? rest.match(/^['"]([\w/]+)#(\w+)['"]/)
      const sym = rest.match(/^:(\w+)/)
      const str = target && kind === 'root' ? null : rest.match(/^['"]\/?([^'"]*)['"]/)
      const routeSeg = sym?.[1] ?? str?.[1] ?? ''
      const verbs = kind === 'match' ? [...(list(rest, 'via') ?? [])].map(v => v.toUpperCase()) : [kind === 'root' ? 'GET' : kind.toUpperCase()]
      const lastSeg = routeSeg.split('/').pop() ?? ''
      const controller = target?.[1] ?? opt(rest, 'controller') ?? f.controller ?? routeSeg.split('/').slice(0, -1).join('/')
      const action = target?.[2] ?? opt(rest, 'action') ?? lastSeg
      if (!action || !verbs.length || (!controller && !f.module.length)) {
        unparsed.push(t)
        continue
      }
      const on = opt(rest, 'on')
      const canonical = Boolean(sym) && CANONICAL_ACTIONS.has(routeSeg) && (f.methodScope || Boolean(on))
      const routePath = kind === 'root' ? f.path : [...onPath(f, on ?? ''), opt(rest, 'path') ?? (canonical ? '' : routeSeg)]
      for (const v of verbs) {
        emit(v, routePath, controller, action, f.module)
      }
      if (block) {
        stack.push({ ...f })
      }
      continue
    }

    if (block || OPENS_KEYWORD_BLOCK.test(t)) {
      stack.push({ ...f })
    }
    if (!IGNORED.test(t) && !OPENS_KEYWORD_BLOCK.test(t) && !/^(else|elsif|when)\b/.test(t)) {
      unparsed.push(t)
    }
  }
  return { routes, unparsed }
}

export function extractRailsRoutes(repoBase: string, repo = 'skello-app'): { routes: RailsRoute[]; unparsed: string[] } | null {
  const configDir = path.join(repoBase, repo, 'config')
  const files = [path.join(configDir, 'routes.rb')]
  const extra = path.join(configDir, 'routes')
  if (fs.existsSync(extra)) {
    files.push(...fs.readdirSync(extra).filter(f => f.endsWith('.rb')).map(f => path.join(extra, f)))
  }
  const present = files.filter(f => fs.existsSync(f))
  if (!present.length) {
    return null
  }
  const routes: RailsRoute[] = []
  const unparsed: string[] = []
  for (const file of present) {
    const parsed = parseRoutesContent(fs.readFileSync(file, 'utf-8'))
    routes.push(...parsed.routes)
    unparsed.push(...parsed.unparsed)
  }
  return { routes, unparsed }
}
export function parseRoutesDump(text: string): Array<{ verb: string; path: string; controllerAction: string }> {
  const out: Array<{ verb: string; path: string; controllerAction: string }> = []
  for (const block of text.split(/^--\[ Route \d+ \]-+$/m)) {
    const field = (name: string) => block.match(new RegExp(`^${name}[ \\t]*\\|[ \\t]*(.*)$`, 'm'))?.[1]?.trim() ?? ''
    const uri = field('URI').replace(/\(\.:format\)$/, '')
    if (!uri) {
      continue
    }
    for (const verb of field('Verb').split('|').filter(Boolean)) {
      out.push({ verb, path: uri, controllerAction: field('Controller#Action').replace(/\s*\{.*\}$/, '') })
    }
  }
  return out
}
