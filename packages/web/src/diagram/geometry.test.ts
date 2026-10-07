import { describe, it, expect } from 'vitest'
import { anchor, contains, edgeSegment, fitLabel, linesHeight, overlaps, wrapText } from './geometry'

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

describe('wrapText', () => {
  const at = (chars: number) => (chars + 0.5) * 11 * 0.6
  const graphemes = (text: string) => [...new Intl.Segmenter().segment(text)].map(s => s.segment)
  it('fills lines word by word', () => {
    expect(wrapText('GET shops and users', at(10), 11)).toEqual(['GET shops', 'and users'])
  })
  it('splits a long identifier after its last separator or camelCase boundary that fits', () => {
    expect(wrapText('perform_later_now', at(10), 11)).toEqual(['perform_', 'later_now'])
    expect(wrapText('SKELLO_ENROLLMENT_QUEUE', at(12), 11)).toEqual(['SKELLO_', 'ENROLLMENT_', 'QUEUE'])
    expect(wrapText('Shifts::CreateService#run', at(12), 11)).toEqual(['Shifts::', 'Create', 'Service#run'])
  })
  it('cuts at the width when an identifier has no boundary', () => {
    expect(wrapText('ABCDEFGHIJKLMNOP', at(6), 11)).toEqual(['ABCDEF', 'GHIJKL', 'MNOP'])
  })
  it('never splits a grapheme, and gives a grapheme wider than the line a line of its own', () => {
    const family = '👨‍👩‍👧'
    const lines = wrapText(`${family}${family}${family}`, at(12), 11)
    expect(lines.join('')).toBe(`${family}${family}${family}`)
    expect(lines.every(l => graphemes(l).every(g => g === family))).toBe(true)
    expect(wrapText(family, at(1), 11)).toEqual([family])
  })
})
