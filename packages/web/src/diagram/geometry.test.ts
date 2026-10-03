import { describe, it, expect } from 'vitest'
import { anchor, contains, edgeSegment, fitLabel, linesHeight, overlaps } from './geometry'

const a = { x: 0, y: 0, w: 100, h: 40 }
const b = { x: 200, y: 0, w: 100, h: 40 }

describe('geometry', () => {
  it('anchors a line on the border facing the target', () => {
    expect(anchor(a, { x: 150, y: 20 })).toEqual({ x: 100, y: 20 })
    expect(anchor(a, { x: 50, y: 100 })).toEqual({ x: 50, y: 40 })
  })
  it('offsets parallel lanes to opposite sides, mirrored for the reverse direction', () => {
    expect(edgeSegment(a, b, 0, 2).y1).toBe(15)
    expect(edgeSegment(a, b, 1, 2).y1).toBe(25)
    expect(edgeSegment(b, a, 0, 2).y1).toBe(25)
    expect(edgeSegment(a, b)).toMatchObject({ x1: 100, y1: 20, x2: 200, y2: 20, lx: 150, ly: 20 })
  })
  it('truncates a label to its box with an ellipsis', () => {
    expect(fitLabel('svc-documents-esignature', 120, 12)).toBe('svc-documents…')
    expect(fitLabel('Planning', 120, 12)).toBe('Planning')
    expect(fitLabel('Planning', 20, 12)).toBe('')
  })
  it('sizes text lines with vertical padding', () => {
    expect(linesHeight(2, 12)).toBe(45)
  })
  it('tells overlap from containment', () => {
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, { x: 90, y: 10, w: 20, h: 20 })).toBe(true)
    expect(contains({ x: 0, y: 0, w: 200, h: 200 }, a)).toBe(true)
    expect(contains(a, { x: 90, y: 10, w: 20, h: 20 })).toBe(false)
  })
})
