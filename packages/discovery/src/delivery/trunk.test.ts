import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { defaultGit, type GitRunner } from '../pinned'
import { NOW, microserviceRepo, monolithRepo, pausedRepo, prodOnlyRepo } from './__fixtures__/repos'
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
  it('keeps sandbox when its merges reach prod', () => {
    expect(trunkOf(microservice, NOW)).toEqual({ prod: 'master', branches: ['staging', 'sandbox'] })
  })

  it('drops sandbox in the monolith shape', () => {
    expect(trunkOf(monolith, NOW)).toEqual({ prod: 'master', branches: ['staging'] })
  })

  it('keeps sandbox when the last promotion is 120 days old', () => {
    expect(trunkOf(pausedRepo(root, 'svc-paused-120', 120).dir, NOW)?.branches).toEqual(['sandbox'])
  })

  it('drops sandbox when the last promotion is 200 days old', () => {
    expect(trunkOf(pausedRepo(root, 'svc-paused-200', 200).dir, NOW)?.branches).toEqual([])
  })

  it('takes main when master is absent', () => {
    expect(trunkOf(prodOnlyRepo(root, 'svc-main', 'main').dir, NOW)).toEqual({ prod: 'main', branches: [] })
  })

  it('returns null without prod', () => {
    const dir = path.join(root, 'no-prod')
    fs.mkdirSync(dir)
    defaultGit(dir, ['init', '-q', '-b', 'sandbox'])
    expect(trunkOf(dir, NOW)).toBeNull()
  })
})

describe('fetchTrunk', () => {
  it('fetches only existing trunk branches, by name, without prune', () => {
    const calls: string[][] = []
    const recording: GitRunner = (cwd, args) => {
      calls.push(args)
      return args[0] === 'fetch' ? '' : defaultGit(cwd, args)
    }
    fetchTrunk(monolith, recording)
    fetchTrunk(prodOnlyRepo(root, 'svc-fetch', 'master').dir, recording)
    expect(calls.filter((args) => args[0] === 'fetch')).toEqual([['fetch', '--quiet', 'origin', 'staging', 'sandbox']])
  })
})
