import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const sources = readdirSync(root, { recursive: true, encoding: 'utf-8' })
  .filter(file => /\.(ts|tsx|css)$/.test(file) && !/\.test\./.test(file))
  .map(file => [file, readFileSync(join(root, file), 'utf-8')])

const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/
const LITERAL_WEIGHT = /font-?[wW]eight:\s*['"]?\d/

describe('diagram canvases', () => {
  it('finds the diagram sources', () => {
    expect(sources.length).toBeGreaterThan(10)
  })

  it.each(sources)('paints %s from the bridged colour tokens only', (_file, source) => {
    expect(source).not.toMatch(LITERAL_COLOUR)
  })

  it.each(sources)('reads font weights in %s from the DS tokens', (_file, source) => {
    expect(source).not.toMatch(LITERAL_WEIGHT)
  })
})
