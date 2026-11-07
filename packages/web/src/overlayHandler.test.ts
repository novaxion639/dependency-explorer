import fs from 'node:fs'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { serveOverlay } from '../vite.config'

const BASE = '/base'
let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-handler-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function request(method: string, url: string) {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = url
  const res = new ServerResponse(req)
  const end = vi.spyOn(res, 'end')
  const next = vi.fn()
  serveOverlay(dir, BASE)(req, res, next)
  return { res, end, next }
}

it('answers 404 when the overlay file is absent', () => {
  const { res, next } = request('GET', '/base/overlay/datadog.json')
  expect(res.statusCode).toBe(404)
  expect(next).not.toHaveBeenCalled()
})

it('serves jira.json and datadog.json', () => {
  fs.writeFileSync(path.join(dir, 'datadog.json'), '{"ok":1}')
  fs.writeFileSync(path.join(dir, 'jira.json'), '{"ok":2}')
  const datadog = request('GET', '/base/overlay/datadog.json?t=1')
  const jira = request('GET', '/base/overlay/jira.json')
  expect(datadog.res.statusCode).toBe(200)
  expect(datadog.res.getHeader('content-type')).toBe('application/json')
  expect(String(datadog.end.mock.calls[0]?.[0])).toBe('{"ok":1}')
  expect(String(jira.end.mock.calls[0]?.[0])).toBe('{"ok":2}')
})

it('404s an absent overlay while serving another', () => {
  fs.writeFileSync(path.join(dir, 'datadog.json'), '{}')
  expect(request('GET', '/base/overlay/jira.json').res.statusCode).toBe(404)
})

it('passes other paths and methods to the next handler', () => {
  fs.writeFileSync(path.join(dir, 'datadog.json'), '{}')
  expect(request('GET', '/overlay/datadog.json').next).toHaveBeenCalledOnce()
  expect(request('POST', '/base/overlay/datadog.json').next).toHaveBeenCalledOnce()
  expect(request('GET', '/base/overlay/datadog.txt').next).toHaveBeenCalledOnce()
})

it('ignores a name with a slash or dots', () => {
  for (const url of ['/base/overlay/../package.json', '/base/overlay/a/b.json', '/base/overlay/a.b.json', '/base/overlay/.json', '/base/overlay/Jira.json']) {
    expect(request('GET', url).next).toHaveBeenCalledOnce()
  }
})
