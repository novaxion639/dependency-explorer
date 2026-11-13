import { describe, expect, it } from 'vitest'
import { unknownFlags } from './cli-args'

describe('unknownFlags', () => {
  it('lists the flags a command does not know, ignoring values and the -- separator', () => {
    expect(unknownFlags(['--', '--pinned', '--jsn', '--aws', 'snap/2026-11-13', '--delivry'], ['--pinned', '--json', '--aws', '--delivery'])).toEqual(['--jsn', '--delivry'])
  })
})
