import path from 'node:path'
import { vi } from 'vitest'

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1'])
const BLOCKED_BINARIES = new Set(['aws', 'gh', 'curl', 'graphify'])

const hostOf = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === 'string') {
    return new URL(input).hostname
  }
  if (input instanceof URL) {
    return input.hostname
  }
  return new URL(input.url).hostname
}

const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const host = hostOf(input)
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`network guard: ${host}`)
  }
  return realFetch(input, init)
}

const firstToken = (command: string): string => command.trim().split(/\s+/)[0] ?? ''

const guarded = <Args extends unknown[], Result>(
  run: (target: string, ...rest: Args) => Result,
  binOf: (target: string) => string = (target) => target,
) =>
  (target: string, ...rest: Args): Result => {
    const bin = path.basename(binOf(target))
    if (BLOCKED_BINARIES.has(bin)) {
      throw new Error(`spawn guard: ${bin}`)
    }
    return run(target, ...rest)
  }

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    exec: guarded(actual.exec, firstToken),
    execSync: guarded(actual.execSync, firstToken),
    execFileSync: guarded(actual.execFileSync),
    execFile: guarded(actual.execFile),
    spawn: guarded(actual.spawn),
    spawnSync: guarded(actual.spawnSync),
  }
})
