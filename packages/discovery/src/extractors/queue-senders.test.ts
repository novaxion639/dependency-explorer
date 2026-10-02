import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { walkFiles } from './queue-senders'

describe('walkFiles', () => {
  it('skips files above the source size cap', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-'))
    fs.writeFileSync(path.join(dir, 'small.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(dir, 'bundle.js'), 'x'.repeat(401 * 1024))
    expect(walkFiles(dir).map(f => path.basename(f))).toEqual(['small.ts'])
  })
})
