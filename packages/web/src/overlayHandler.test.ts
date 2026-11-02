import fs from 'node:fs'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { serveOverlay } from '../vite.config'

const ROUTE = '/base/overlay/datadog.json'
let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-handler-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function request(file: string, method: string, url: string) {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = url
  const res = new ServerResponse(req)
  const end = vi.spyOn(res, 'end')
  const next = vi.fn()
  serveOverlay(file, ROUTE)(req, res, next)
  return { res, end, next }
}

it('answers 404 when the overlay file is absent', () => {
  const { res, next } = request(path.join(dir, 'datadog.json'), 'GET', ROUTE)
  expect(res.statusCode).toBe(404)
  expect(next).not.toHaveBeenCalled()
})

it('serves the overlay file as JSON', () => {
  const file = path.join(dir, 'datadog.json')
  fs.writeFileSync(file, '{"ok":1}')
  const { res, end } = request(file, 'GET', `${ROUTE}?t=1`)
  expect(res.statusCode).toBe(200)
  expect(res.getHeader('content-type')).toBe('application/json')
  expect(String(end.mock.calls[0]?.[0])).toBe('{"ok":1}')
})

it('passes other paths and methods to the next handler', () => {
  const file = path.join(dir, 'datadog.json')
  expect(request(file, 'GET', '/overlay/datadog.json').next).toHaveBeenCalledOnce()
  expect(request(file, 'POST', ROUTE).next).toHaveBeenCalledOnce()
})
