import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { build } from 'vite'

const WEB = path.resolve(import.meta.dirname, '..')
const OVERLAY_DIR = path.join(WEB, 'overlay')
const OVERLAY = path.join(OVERLAY_DIR, 'datadog.json')
let outDir = ''
let createdDir = false

afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
  if (createdDir) {
    fs.rmSync(OVERLAY_DIR, { recursive: true, force: true })
  }
})

it('leaves the Datadog overlay out of the build output', async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-'))
  createdDir = !fs.existsSync(OVERLAY_DIR)
  if (createdDir) {
    fs.mkdirSync(OVERLAY_DIR)
    fs.writeFileSync(OVERLAY, '{}')
  }

  await build({ root: WEB, configFile: path.join(WEB, 'vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } })

  expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true)
  expect(fs.existsSync(path.join(outDir, 'overlay'))).toBe(false)
}, 180_000)
