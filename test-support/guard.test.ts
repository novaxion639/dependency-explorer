import { exec, execFileSync, execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const BLOCKED = ['aws', 'gh', 'curl', 'graphify']

describe('test guard', () => {
  it('refuses a fetch to a remote host', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow('network guard: example.com')
  })
  it('rejects a relative URL instead of throwing synchronously', async () => {
    await expect(fetch('/relative')).rejects.toThrow()
  })
  it('lets a fetch to localhost through to the stub', async () => {
    await expect(fetch('http://127.0.0.1:9/x')).rejects.not.toThrow(/network guard/)
  })
  it.each(BLOCKED)('refuses execFileSync %s', (bin) => {
    expect(() => execFileSync(bin, ['--version'])).toThrow(`spawn guard: ${bin}`)
  })
  it.each(BLOCKED)('refuses execSync %s', (bin) => {
    expect(() => execSync(`${bin} --version`)).toThrow(`spawn guard: ${bin}`)
  })
  it.each(BLOCKED)('refuses exec %s', (bin) => {
    expect(() => exec(`${bin} --version`)).toThrow(`spawn guard: ${bin}`)
  })
  it('refuses a binary given by absolute path', () => {
    expect(() => execFileSync('/opt/homebrew/bin/aws', ['--version'])).toThrow('spawn guard: aws')
  })
  it('lets git run', () => {
    expect(execFileSync('git', ['--version']).toString()).toMatch(/git version/)
    expect(execSync('git --version').toString()).toMatch(/git version/)
  })
})
