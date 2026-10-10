import type { Emphases, Emphasis } from '../focus'
import type { DiagramGroup, DiagramModel, EdgeMode } from '../model'
import { strokeWidth } from '../paint'

const ARROW: Record<EdgeMode, { directed: string; plain: string }> = {
  sync: { directed: '-->', plain: '---' },
  async: { directed: '-.->', plain: '-.-' },
  'data-feed': { directed: '-.->', plain: '-.-' },
}

const CLASSES: Array<{ emphasis: Emphasis; style: (read: (token: string) => string) => string }> = [
  { emphasis: 'dim', style: () => 'opacity:0.45' },
  { emphasis: 'on', style: read => `fill:${read('--highlight')},stroke:${read('--ink')}` },
  { emphasis: 'origin', style: read => `fill:${read('--ink')},color:${read('--card')}` },
  { emphasis: 'fails', style: read => `stroke:${read('--fails')},color:${read('--fails')},stroke-width:3px` },
  { emphasis: 'starves', style: read => `stroke:${read('--starves')},color:${read('--starves')},stroke-width:3px` },
  { emphasis: 'degrades', style: read => `stroke:${read('--degrades')},color:${read('--degrades')},stroke-width:3px` },
]

function text(value: string): string {
  return value.replace(/"/g, '#quot;')
}

export function toMermaid(model: DiagramModel, emphases: Emphases, read: (token: string) => string): string {
  const ids = new Map<string, string>()
  model.groups.forEach((g, i) => ids.set(g.id, `g${i}`))
  model.nodes.forEach((n, i) => ids.set(n.id, `n${i}`))
  const id = (key: string) => ids.get(key) ?? key
  const nodeById = new Map(model.nodes.map(n => [n.id, n]))
  const groupById = new Map(model.groups.map(g => [g.id, g]))
  const order = new Map(model.groups.map((g, i) => [g.id, i]))
  const within = (inner: DiagramGroup, outer: DiagramGroup) => inner !== outer && inner.members.length > 0 && inner.members.every(m => outer.members.includes(m))
    && (outer.members.length > inner.members.length || (order.get(outer.id) ?? 0) < (order.get(inner.id) ?? 0))
  const parentOf = new Map(model.groups.flatMap(g => {
    const holders = model.groups.filter(o => within(g, o)).sort((a, b) => a.members.length - b.members.length)
    return holders[0] ? [[g.id, holders[0].id] as const] : []
  }))
  const nested = new Set([...model.groups.flatMap(g => g.members), ...parentOf.keys()])
  const lines = ['flowchart LR']
  const emitNode = (key: string, indent: string) => {
    const n = nodeById.get(key)
    if (n) {
      const label = [n.label, ...n.detail, ...n.stores.map(s => s.label)].filter(Boolean).map(text).join('<br/>')
      lines.push(n.kind === 'choice' ? `${indent}${id(key)}{"${label}"}` : `${indent}${id(key)}["${label}"]`)
    }
  }
  const emitGroup = (key: string, indent: string) => {
    const g = groupById.get(key)
    if (!g) {
      emitNode(key, indent)
      return
    }
    lines.push(`${indent}subgraph ${id(key)}["${text(g.label)}"]`)
    lines.push(`${indent}  direction LR`)
    const children = model.groups.filter(c => parentOf.get(c.id) === key)
    const covered = new Set(children.flatMap(c => c.members))
    for (const c of children) {
      emitGroup(c.id, `${indent}  `)
    }
    for (const m of g.members.filter(x => !covered.has(x))) {
      emitGroup(m, `${indent}  `)
    }
    lines.push(`${indent}end`)
  }
  for (const g of model.groups.filter(g => !nested.has(g.id))) {
    emitGroup(g.id, '  ')
  }
  for (const n of model.nodes.filter(n => !nested.has(n.id))) {
    emitNode(n.id, '  ')
  }
  model.edges.forEach((e, i) => {
    const arrow = e.directed ? ARROW[e.mode].directed : ARROW[e.mode].plain
    const label = e.condition ? `${e.label} · if ${e.condition}` : e.label
    lines.push(label ? `  ${id(e.from)} ${arrow}|"${text(label)}"| ${id(e.to)}` : `  ${id(e.from)} ${arrow} ${id(e.to)}`)
    const dim = emphases.edges.get(e.id) === 'dim' ? ',opacity:0.45' : ''
    lines.push(`  linkStyle ${i} stroke-width:${strokeWidth(e.weight)}px${e.mode === 'data-feed' ? ',stroke-dasharray:2 4' : ''}${dim}`)
  })
  for (const { emphasis, style } of CLASSES) {
    const members = [...emphases.nodes, ...emphases.groups].filter(([, value]) => value === emphasis).map(([key]) => id(key))
    if (members.length) {
      lines.push(`  classDef ${emphasis} ${style(read)}`, `  class ${members.join(',')} ${emphasis}`)
    }
  }
  return lines.join('\n')
}
