import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const OVERLAY_DIR = fileURLToPath(new URL('./overlay', import.meta.url))
const OVERLAY_NAME = /^[a-z0-9-]+$/

export const serveOverlay =
  (dir: string, base: string): Connect.NextHandleFunction =>
  (req, res, next) => {
    const prefix = `${base.replace(/\/$/, '')}/overlay/`
    const url = req.url?.split('?')[0] ?? ''
    const name = url.startsWith(prefix) && url.endsWith('.json') ? url.slice(prefix.length, -'.json'.length) : ''
    if (req.method !== 'GET' || !OVERLAY_NAME.test(name)) {
      next()
      return
    }
    const file = path.join(dir, `${name}.json`)
    if (!fs.existsSync(file)) {
      res.statusCode = 404
      res.end()
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(fs.readFileSync(file))
  }

function overlayServe(): Plugin {
  let base = '/'
  const serve: Connect.NextHandleFunction = (req, res, next) => serveOverlay(OVERLAY_DIR, base)(req, res, next)
  return {
    name: 'overlay-serve',
    configResolved(config) {
      base = config.base
    },
    configureServer(server) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
  }
}

export default defineConfig({
  plugins: [react(), overlayServe()],
  test: {
    setupFiles: ['../../test-support/guard.ts'],
  },
})
