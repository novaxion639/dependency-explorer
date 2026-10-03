import { contains, linesHeight, overlaps, PAD_X, textWidth } from './geometry'
import type { Box, DiagramModel } from './model'

export function layoutProblems(model: DiagramModel): string[] {
  const problems: string[] = []
  const boxes = new Map<string, Box>([...model.groups, ...model.nodes].map(b => [b.id, b]))
  if (boxes.size !== model.groups.length + model.nodes.length) {
    problems.push('two boxes share an id')
  }
  for (const [id, b] of boxes) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > model.width || b.y + b.h > model.height) {
      problems.push(`box leaves the canvas: ${id}`)
    }
  }
  for (const e of model.edges) {
    if (!boxes.has(e.from) || !boxes.has(e.to)) {
      problems.push(`edge joins a missing box: ${e.id}`)
    }
  }
  for (const g of model.groups) {
    for (const m of g.members) {
      const member = boxes.get(m)
      if (!member || !contains(g, member)) {
        problems.push(`${m} sits outside ${g.id}`)
      }
    }
    if (textWidth(g.label, g.fontSize) + 2 * PAD_X > g.w) {
      problems.push(`group label overflows: ${g.id}`)
    }
  }
  model.nodes.forEach((a, i) => {
    for (const b of model.nodes.slice(i + 1)) {
      if (overlaps(a, b)) {
        problems.push(`nodes overlap: ${a.id} / ${b.id}`)
      }
    }
    for (const g of model.groups) {
      if (overlaps(a, g) && !contains(g, a)) {
        problems.push(`node ${a.id} straddles ${g.id}`)
      }
    }
    const lines = [a.label, ...a.detail, ...a.stores.map(s => s.label)].filter(Boolean)
    if (lines.some(l => textWidth(l, a.fontSize) + 2 * PAD_X > a.w)) {
      problems.push(`text overflows: ${a.id}`)
    }
    if (linesHeight(lines.length, a.fontSize) > a.h) {
      problems.push(`lines overflow: ${a.id}`)
    }
  })
  model.groups.forEach((a, i) => {
    for (const b of model.groups.slice(i + 1)) {
      if (overlaps(a, b) && !contains(a, b) && !contains(b, a)) {
        problems.push(`groups overlap: ${a.id} / ${b.id}`)
      }
    }
  })
  return problems
}
