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
globalThis.fetch = (input, init) => {
  const host = hostOf(input)
  if (!ALLOWED_HOSTS.has(host)) {
    return Promise.reject(new Error(`network guard: ${host}`))
  }
  return realFetch(input, init)
}

const guarded = <Args extends unknown[], Result>(run: (bin: string, ...rest: Args) => Result) =>
  (bin: string, ...rest: Args): Result => {
    if (BLOCKED_BINARIES.has(bin)) {
      throw new Error(`spawn guard: ${bin}`)
    }
    return run(bin, ...rest)
  }

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execFileSync: guarded(actual.execFileSync),
    execFile: guarded(actual.execFile),
    spawn: guarded(actual.spawn),
    spawnSync: guarded(actual.spawnSync),
  }
})
