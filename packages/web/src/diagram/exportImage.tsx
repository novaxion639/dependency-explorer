import { renderToStaticMarkup } from 'react-dom/server'
import type { Emphases } from './focus'
import type { DiagramModel } from './model'
import { SvgDiagram } from './renderers/SvgDiagram'
import { inlineTokens } from './tokens'

const PNG_SCALE = 2
const FALLBACK_SIZE = { width: 1200, height: 800 }

export function standaloneSvg(model: DiagramModel, emphases: Emphases, read: (token: string) => string): string {
  return inlineTokens(renderToStaticMarkup(<SvgDiagram model={model} emphases={emphases} />), read)
}

export function svgSize(svg: string): { width: number; height: number } {
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg)
  return box ? { width: Math.ceil(Number(box[1])), height: Math.ceil(Number(box[2])) } : FALLBACK_SIZE
}

// Safari refuses canvases above 16,777,216 pixels (4096²).
const MAX_CANVAS_PIXELS = 16_777_216

export function pngScale(size: { width: number; height: number }): number {
  return Math.min(PNG_SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height)))
}

export async function svgToPng(svg: string, size: { width: number; height: number }, background: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = pngScale(size)
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(size.width * scale)
    canvas.height = Math.floor(size.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D is unavailable')
    }
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, size.width, size.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function download(filename: string, href: string): void {
  const a = document.createElement('a')
  a.download = filename
  a.href = href
  a.click()
}

export function exportName(base: string, ext: 'png' | 'svg'): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}.${ext}`
}
