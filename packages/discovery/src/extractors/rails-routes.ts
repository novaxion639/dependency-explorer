import * as fs from 'node:fs'
import * as path from 'node:path'

export interface RailsRoute { verb: string; path: string; controller: string; action: string; controllerFile: string }

interface Frame { path: string[]; module: string[]; controller: string | null; memberOf: string | null }

const REST = {
  plural: [['GET', '', 'index'], ['POST', '', 'create'], ['GET', '/new', 'new'], ['GET', '/:id/edit', 'edit'], ['GET', '/:id', 'show'], ['PATCH', '/:id', 'update'], ['PUT', '/:id', 'update'], ['DELETE', '/:id', 'destroy']],
  singular: [['POST', '', 'create'], ['GET', '/new', 'new'], ['GET', '/edit', 'edit'], ['GET', '', 'show'], ['PATCH', '', 'update'], ['PUT', '', 'update'], ['DELETE', '', 'destroy']],
} as const

const OPENS_BLOCK = /\bdo\s*(\|[^|]*\|)?\s*$/
const IS_END = /^\s*end\b/

function opt(line: string, key: string): string | null {
  const m = line.match(new RegExp(`\\b${key}:\\s*['":]([\\w/]+)['"]?`))
  return m?.[1] ?? null
}

function only(line: string): Set<string> | null {
  const m = line.match(/\bonly:\s*(?:\[([^\]]*)\]|:(\w+))/)
  if (!m) {
    return null
  }
  return new Set((m[1] ?? m[2] ?? '').split(',').map(s => s.trim().replace(/^:/, '')).filter(Boolean))
}

function pluralize(word: string): string {
  if (word.endsWith('y')) {
    return `${word.slice(0, -1)}ies`
  }
  return word.endsWith('s') ? word : `${word}s`
}

function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`
  }
  return word.endsWith('s') ? word.slice(0, -1) : word
}

function join(parts: string[]): string {
  const p = parts.flatMap(s => s.split('/')).filter(Boolean).join('/')
  return `/${p}`
}

function onPath(f: Frame, on: string): string[] {
  if (!f.memberOf) {
    return f.path
  }
  if (on === 'member') {
    return [...f.path.slice(0, -1), ':id']
  }
  return on === 'collection' ? f.path.slice(0, -1) : f.path
}

export function parseRoutesContent(content: string): { routes: RailsRoute[]; unparsed: string[] } {
  const routes: RailsRoute[] = []
  const unparsed: string[] = []
  const stack: Frame[] = [{ path: [], module: [], controller: null, memberOf: null }]
  const top = (): Frame => stack[stack.length - 1] ?? { path: [], module: [], controller: null, memberOf: null }
  const emit = (verb: string, routePath: string[], controller: string, action: string, moduleParts: string[]) => {
    const fullController = [...moduleParts, controller].filter(Boolean).join('/')
    routes.push({ verb, path: join(routePath), controller: fullController, action, controllerFile: `app/controllers/${fullController}_controller.rb` })
  }

  for (const raw of content.split('\n')) {
    const line = raw.replace(/(^|\s)#(?!\{).*$/, '$1').trimEnd()
    const t = line.trim()
    if (!t || /^Rails\.application\.routes\.draw/.test(t)) {
      continue
    }
    if (IS_END.test(line)) {
      if (stack.length > 1) {
        stack.pop()
      }
      continue
    }
    const f = top()
    const block = OPENS_BLOCK.test(line)

    const ns = t.match(/^namespace\s+:(\w+)/)
    if (ns) {
      const name = ns[1] ?? ''
      if (block) {
        stack.push({ path: [...f.path, opt(t, 'path') ?? name], module: [...f.module, opt(t, 'module') ?? name], controller: null, memberOf: null })
      }
      continue
    }

    const scope = t.match(/^scope\b(?:\s+['"]\/?([\w/:]+)['"])?/)
    if (scope && block) {
      const p = scope[1] ?? opt(t, 'path')
      const m = opt(t, 'module')
      stack.push({ path: p ? [...f.path, p] : f.path, module: m ? [...f.module, m] : f.module, controller: f.controller, memberOf: f.memberOf })
      continue
    }

    const scopeBlock = t.match(/^(member|collection)\s+do/)
    if (scopeBlock) {
      stack.push({ ...f, path: onPath(f, scopeBlock[1] ?? '') })
      continue
    }

    const res = t.match(/^(resources|resource)\s+:(\w+)/)
    if (res) {
      const singular = res[1] === 'resource'
      const name = res[2] ?? ''
      const seg = opt(t, 'path') ?? name
      const controller = opt(t, 'controller') ?? (singular ? pluralize(name) : name)
      const moduleParts = opt(t, 'module') ? [...f.module, opt(t, 'module') ?? ''] : f.module
      const allowed = only(t)
      for (const [verb, suffix, action] of singular ? REST.singular : REST.plural) {
        if (!allowed || allowed.has(action)) {
          emit(verb, [...f.path, seg, suffix], controller, action, moduleParts)
        }
      }
      if (block) {
        const nested = singular ? [...f.path, seg] : [...f.path, seg, `:${singularize(name)}_id`]
        stack.push({ path: nested, module: moduleParts, controller, memberOf: singular ? null : seg })
      }
      continue
    }

    const verb = t.match(/^(get|post|put|patch|delete|root)\b\s*(.*)$/)
    if (verb) {
      const kind = verb[1] ?? ''
      const rest = verb[2] ?? ''
      const target = rest.match(/(?:to:|=>)\s*['"]([\w/]+)#(\w+)['"]/)
      const sym = rest.match(/^:(\w+)/)
      const str = rest.match(/^['"]\/?([^'"]*)['"]/)
      const routeSeg = sym?.[1] ?? str?.[1] ?? ''
      const httpVerb = kind === 'root' ? 'GET' : kind.toUpperCase()
      const controller = target?.[1] ?? f.controller ?? routeSeg.split('/').slice(0, -1).join('/')
      const action = target?.[2] ?? opt(rest, 'action') ?? routeSeg.split('/').pop() ?? ''
      if (!controller || !action) {
        unparsed.push(t)
        continue
      }
      emit(httpVerb, kind === 'root' ? f.path : [...onPath(f, opt(rest, 'on') ?? ''), routeSeg], controller, action, f.module)
      if (block) {
        stack.push({ ...f })
      }
      continue
    }

    if (block) {
      stack.push({ ...f })
    }
    if (!/^(constraints|concern|draw)\b/.test(t)) {
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
