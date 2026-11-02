import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('test guard', () => {
  it('refuses a fetch to a remote host', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow('network guard: example.com')
  })
  it('lets a fetch to localhost through to the stub', async () => {
    await expect(fetch('http://127.0.0.1:9/x')).rejects.not.toThrow(/network guard/)
  })
  it('refuses to spawn aws, gh, curl or graphify', () => {
    expect(() => execFileSync('aws', ['--version'])).toThrow('spawn guard: aws')
    expect(() => execFileSync('graphify', ['--help'])).toThrow('spawn guard: graphify')
  })
  it('lets git run', () => {
    expect(execFileSync('git', ['--version']).toString()).toMatch(/git version/)
  })
})
