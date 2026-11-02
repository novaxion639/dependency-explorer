import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { build } from 'vite'

const WEB = path.resolve(import.meta.dirname, '..')
const OVERLAY_DIR = path.join(WEB, 'overlay')
const NAMES = ['datadog', 'jira']
let outDir = ''
let created: string[] = []

afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
  created.forEach(file => fs.rmSync(file, { force: true }))
  created = []
  if (fs.existsSync(OVERLAY_DIR) && fs.readdirSync(OVERLAY_DIR).length === 0) {
    fs.rmdirSync(OVERLAY_DIR)
  }
})

it('leaves both overlays out of the build output', async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-'))
  fs.mkdirSync(OVERLAY_DIR, { recursive: true })
  for (const name of NAMES) {
    const file = path.join(OVERLAY_DIR, `${name}.json`)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '{}')
      created.push(file)
    }
  }

  await build({ root: WEB, configFile: path.join(WEB, 'vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } })

  expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true)
  expect(fs.existsSync(path.join(outDir, 'overlay'))).toBe(false)
}, 180_000)
