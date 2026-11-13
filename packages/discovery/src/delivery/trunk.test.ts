import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { defaultGit, type GitRunner } from '../pinned'
import { microserviceRepo, monolithRepo, pausedRepo, prodOnlyRepo } from './__fixtures__/repos'
import { fetchTrunk, trunkOf } from './trunk'

let root = ''
let microservice = ''
let monolith = ''

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'trunk-'))
  microservice = microserviceRepo(root).dir
  monolith = monolithRepo(root).dir
}, 30_000)

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('trunkOf', () => {
  it('reads staging when it exists', () => {
    expect(trunkOf(microservice)).toEqual({ prod: 'master', staging: true })
    expect(trunkOf(monolith)).toEqual({ prod: 'master', staging: true })
  })

  it('never reads sandbox', () => {
    expect(trunkOf(pausedRepo(root, 'svc-sandbox-only', 120).dir)).toEqual({ prod: 'master', staging: false })
  })

  it('takes main when master is absent', () => {
    expect(trunkOf(prodOnlyRepo(root, 'svc-main', 'main').dir)).toEqual({ prod: 'main', staging: false })
  })

  it('returns null without prod', () => {
    const dir = path.join(root, 'no-prod')
    fs.mkdirSync(dir)
    defaultGit(dir, ['init', '-q', '-b', 'sandbox'])
    expect(trunkOf(dir)).toBeNull()
  })
})

describe('fetchTrunk', () => {
  it('fetches staging by name, without prune, only where it exists', () => {
    const calls: string[][] = []
    const recording: GitRunner = (cwd, args) => {
      calls.push(args)
      return args[0] === 'fetch' ? '' : defaultGit(cwd, args)
    }
    fetchTrunk(monolith, recording)
    fetchTrunk(prodOnlyRepo(root, 'svc-fetch', 'master').dir, recording)
    expect(calls.filter((args) => args[0] === 'fetch')).toEqual([['fetch', '--quiet', 'origin', 'staging']])
  })
})
