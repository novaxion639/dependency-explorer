import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const OVERLAY_FILE = fileURLToPath(new URL('./overlay/datadog.json', import.meta.url))

function overlayServe(): Plugin {
  let route = '/overlay/datadog.json'
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'GET' || req.url?.split('?')[0] !== route) {
      next()
      return
    }
    if (!fs.existsSync(OVERLAY_FILE)) {
      res.statusCode = 404
      res.end()
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(fs.readFileSync(OVERLAY_FILE))
  }
  return {
    name: 'overlay-serve',
    configResolved(config) {
      route = `${config.base.replace(/\/$/, '')}/overlay/datadog.json`
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
