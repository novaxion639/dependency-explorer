import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { walkTree } from './walk'

describe('walkTree', () => {
  it('descends into directories it does not skip and keeps the files it accepts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-'))
    fs.mkdirSync(path.join(root, 'src', 'deep'), { recursive: true })
    fs.mkdirSync(path.join(root, 'node_modules'))
    fs.writeFileSync(path.join(root, 'src', 'a.ts'), '')
    fs.writeFileSync(path.join(root, 'src', 'deep', 'b.ts'), '')
    fs.writeFileSync(path.join(root, 'src', 'c.md'), '')
    fs.writeFileSync(path.join(root, 'node_modules', 'd.ts'), '')

    const files = walkTree(root, e => e.name === 'node_modules', e => e.name.endsWith('.ts')).map(f => path.relative(root, f)).sort()

    expect(files).toEqual([path.join('src', 'a.ts'), path.join('src', 'deep', 'b.ts')])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('returns nothing for a folder that does not exist', () => {
    expect(walkTree(path.join(os.tmpdir(), 'walk-missing-folder'), () => false, () => true)).toEqual([])
  })
})
