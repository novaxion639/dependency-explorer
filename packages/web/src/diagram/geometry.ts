import type { Box } from './model'

export const PAD_X = 8
export const PAD_Y = 6
export const LINE_HEIGHT = 1.35
const CHAR_WIDTH = 0.6
const LANE_GAP = 10

export interface Point { x: number; y: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number; lx: number; ly: number }

export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH
}

export function fitLabel(text: string, width: number, fontSize: number): string {
  const max = Math.floor((width - 2 * PAD_X) / (fontSize * CHAR_WIDTH))
  if (text.length <= max) {
    return text
  }
  return max < 2 ? '' : `${text.slice(0, max - 1)}…`
}

export function linesHeight(lines: number, fontSize: number): number {
  return Math.ceil(lines * fontSize * LINE_HEIGHT + 2 * PAD_Y)
}

export function centre(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export function anchor(b: Box, toward: Point): Point {
  const c = centre(b)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  const sx = dx === 0 ? Infinity : b.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : b.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return Number.isFinite(s) ? { x: c.x + dx * s, y: c.y + dy * s } : c
}

export function edgeSegment(a: Box, b: Box, lane = 0, lanes = 1): Segment {
  const ca = centre(a)
  const cb = centre(b)
  const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1
  const offset = (lane - (lanes - 1) / 2) * LANE_GAP
  const nx = (-(cb.y - ca.y) / len) * offset
  const ny = ((cb.x - ca.x) / len) * offset
  const p1 = anchor(a, cb)
  const p2 = anchor(b, ca)
  const x1 = p1.x + nx
  const y1 = p1.y + ny
  const x2 = p2.x + nx
  const y2 = p2.y + ny
  return { x1, y1, x2, y2, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 }
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function contains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}
