import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRoutesContent } from './rails-routes'

const ENGINE_ROUTE = /^\/rails\/| stripe_event\//
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf-8')

function parseRoutesDump(text: string): Array<{ verb: string; path: string; controllerAction: string }> {
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

describe('routes parser vs rails routes --expanded', () => {
  it('reproduces at least 98% of the router triples', () => {
    const truth = parseRoutesDump(read('skello-app-routes-expanded.txt')).filter(r => !ENGINE_ROUTE.test(`${r.path} ${r.controllerAction}`))
    const parsed = [...parseRoutesContent(read('skello-app-routes.rb')).routes, ...parseRoutesContent(read('skello-app-public-api-routes.rb')).routes]
    const got = new Set(parsed.map(r => `${r.verb} ${r.path} ${r.controller}#${r.action}`))
    const missed = truth.filter(r => !got.has(`${r.verb} ${r.path} ${r.controllerAction}`))
    const ratio = 1 - missed.length / truth.length
    expect(ratio, `missed ${missed.length}/${truth.length}:\n${missed.slice(0, 40).map(m => `${m.verb} ${m.path} ${m.controllerAction}`).join('\n')}`).toBeGreaterThanOrEqual(0.98)
  })
})
