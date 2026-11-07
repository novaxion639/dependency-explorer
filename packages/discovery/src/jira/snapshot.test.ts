import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SnapshotFormatError } from '../snapshot-dir'
import { jiraClient } from './client'
import { runJiraFetchCli } from './fetch-cli'
import { fetchJiraSnapshot, readJiraSnapshot, writeJiraSnapshot, type JiraSnapshot } from './snapshot'

const EMAIL = 'fake.user@example.invalid'
const TOKEN = 'fake-jira-token-0123456789'
const ENV = { JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN }
const NOW = new Date('2026-11-02T10:30:00Z')
const SENTINEL = /SENTINEL-[A-Z-]+/

type Call = { method: string; path: string; params: URLSearchParams; headers: Headers; host: string; signal: unknown }
type Failure = { status: number; headers?: Record<string, string> }

const fixture = (name: string): unknown => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))

const answer = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })

const unauthorized = () => answer({ errorMessages: ['Unauthorized'] }, 401)

const fullSuggestions = () => answer({ results: Array.from({ length: 15 }, (_, k) => ({ value: `Area ${k}` })) })

function fakeJira(options: { overrides?: Record<string, (url: URL) => Response>; failures?: Failure[]; delayed?: boolean } = {}) {
  const { overrides = {} } = options
  const failures = [...(options.failures ?? [])]
  const calls: Call[] = []
  const flight = { running: 0, peak: 0 }
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, params: url.searchParams, headers: new Headers(init?.headers), host: url.host, signal: init?.signal })
    flight.peak = Math.max(flight.peak, ++flight.running)
    try {
      if (options.delayed) {
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
      const failure = failures.shift()
      if (failure) {
        return answer({ errorMessages: ['fictitious'] }, failure.status, failure.headers)
      }
      const override = overrides[url.pathname]
      if (override) {
        return override(url)
      }
      const startAt = url.searchParams.get('startAt') ?? '0'
      const boardIssues = /^\/rest\/agile\/1\.0\/board\/(\d+)\/issue$/.exec(url.pathname)
      if (boardIssues) {
        return answer(fixture(`board-issues-${boardIssues[1]}-${startAt}`))
      }
      switch (url.pathname) {
        case '/rest/api/3/myself':
          return answer(fixture('myself'))
        case '/rest/api/3/status':
          return answer(fixture('statuses'))
        case '/rest/api/3/jql/autocompletedata/suggestions':
          return answer(fixture('suggestions'))
        case '/rest/agile/1.0/board':
          return answer(fixture(`boards-page-${startAt === '0' ? 0 : 1}`))
        case '/rest/api/3/search/jql':
          return answer(fixture(url.searchParams.get('nextPageToken') ? 'search-page-1' : 'search-page-0'))
        default:
          return answer({ errorMessages: ['Not found'] }, 404)
      }
    } finally {
      flight.running--
    }
  }
  return { fetch, calls, flight }
}

const clientOf = (fetch: typeof globalThis.fetch, sleeps: number[] = []) =>
  jiraClient({ fetch, host: 'jira.example.invalid', email: EMAIL, token: TOKEN, wire: { sleep: (ms) => Promise.resolve(void sleeps.push(ms)) } })

const BOARD_IDS = [11, 12]

describe('fetchJiraSnapshot', () => {
  it('checks myself first, then statuses, labels, boards, bugs, board issues', async () => {
    const { fetch, calls } = fakeJira()
    const snapshot = await fetchJiraSnapshot(clientOf(fetch), BOARD_IDS, NOW)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /rest/api/3/myself',
      'GET /rest/api/3/status',
      'GET /rest/api/3/jql/autocompletedata/suggestions',
      'GET /rest/agile/1.0/board',
      'GET /rest/agile/1.0/board',
      'GET /rest/api/3/search/jql',
      'GET /rest/api/3/search/jql',
      'GET /rest/agile/1.0/board/11/issue',
      'GET /rest/agile/1.0/board/11/issue',
      'GET /rest/agile/1.0/board/12/issue',
    ])
    expect(calls.every((c) => c.host === 'jira.example.invalid' && c.signal instanceof AbortSignal)).toBe(true)
    expect(calls[0]?.headers.get('Authorization')).toBe(`Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`)
    expect(snapshot.meta).toEqual({ fetchedAt: NOW.toISOString(), host: 'jira.example.invalid' })
    expect(snapshot.statuses).toEqual(['Done', 'Go for MEP', 'In Progress', 'QA', 'To Do'])
    expect(snapshot.boardBugs).toEqual({ '11': ['BR-1', 'BR-4'], '12': ['BR-1'] })
  })

  it('asks the suggestions for the Feature Area field and keeps raw labels', async () => {
    const { fetch, calls } = fakeJira()
    const { featureAreaLabels } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    const [suggestions] = calls.filter((c) => c.path.endsWith('/suggestions'))
    expect(suggestions?.params.get('fieldName')).toBe('cf[11070]')
    expect(suggestions?.params.has('fieldValue')).toBe(false)
    expect(featureAreaLabels).toEqual(['Grille_hebdomadaire', 'Shifts "beta"', 'Time off'])
  })

  it('walks the prefixes of a full answer, two characters deep, within 150 calls', async () => {
    const { fetch, calls } = fakeJira({ overrides: { '/rest/api/3/jql/autocompletedata/suggestions': fullSuggestions } })
    const { featureAreaLabels } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    const typed = calls.filter((c) => c.path.endsWith('/suggestions')).map((c) => c.params.get('fieldValue'))
    expect(typed).toHaveLength(150)
    expect(typed.slice(0, 3)).toEqual([null, 'a', 'b'])
    expect(typed).toContain('é')
    expect(typed).toContain('aa')
    expect(typed.every((t) => (t ?? '').length <= 2)).toBe(true)
    expect(featureAreaLabels).toHaveLength(15)
  })

  it('stops the walk at a prefix whose answer is not full', async () => {
    let asked = 0
    const sometimesFull = (url: URL) => {
      asked++
      return url.searchParams.get('fieldValue') === null ? fullSuggestions() : answer({ results: [{ value: 'Area 0' }] })
    }
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/jql/autocompletedata/suggestions': sometimesFull } })
    await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(asked).toBe(45)
  })

  it.each([
    [['To Do', 'QA', 'Go for MEP'], 'statusCategory != Done OR status in ("QA", "Go for MEP")'],
    [['To Do', 'QA'], 'statusCategory != Done OR status in ("QA")'],
    [['To Do'], 'statusCategory != Done'],
  ])('names only existing to-ship statuses (%j)', async (site, open) => {
    const statuses = () => answer(site.map((name) => ({ name })))
    const { fetch, calls } = fakeJira({ overrides: { '/rest/api/3/status': statuses } })
    await fetchJiraSnapshot(clientOf(fetch), [11], NOW)

    const scope = 'project = BR AND issuetype = Bug AND status != Deleted'
    const [search] = calls.filter((c) => c.path === '/rest/api/3/search/jql')
    expect(search?.params.get('jql')).toBe(`${scope} AND (${open} OR created >= -90d)`)
    expect(search?.params.get('fields')).toBe('created,status,priority,resolution,customfield_11070,customfield_10632')
    const [boardIssues] = calls.filter((c) => c.path === '/rest/agile/1.0/board/11/issue')
    expect(boardIssues?.params.get('jql')).toBe(`${scope} AND (${open})`)
    expect(boardIssues?.params.get('fields')).toBe('key')
  })

  it('reads every search page by nextPageToken and every board page', async () => {
    const { fetch, calls } = fakeJira()
    const snapshot = await fetchJiraSnapshot(clientOf(fetch), BOARD_IDS, NOW)

    const searches = calls.filter((c) => c.path === '/rest/api/3/search/jql')
    expect(searches.map((c) => c.params.get('nextPageToken'))).toEqual([null, 'tok-1'])
    expect(calls.filter((c) => c.path === '/rest/agile/1.0/board').map((c) => c.params.get('startAt'))).toEqual(['0', '1'])
    expect(calls.filter((c) => c.path === '/rest/agile/1.0/board/11/issue').map((c) => c.params.get('startAt'))).toEqual(['0', '1'])
    expect(snapshot.bugs.map((b) => b.key)).toEqual(['BR-1', 'BR-2', 'BR-4'])
    expect(snapshot.boards).toEqual([
      { id: 11, name: 'Alpha board', type: 'scrum', projectKey: 'BR' },
      { id: 12, name: 'Beta board', type: 'kanban', projectKey: null },
    ])
  })

  it('ends the board pages on a page without values', async () => {
    const stuck = () => answer({ isLast: false, values: [] })
    const { fetch, calls } = fakeJira({ overrides: { '/rest/agile/1.0/board': stuck } })
    const snapshot = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(calls.filter((c) => c.path === '/rest/agile/1.0/board')).toHaveLength(1)
    expect(snapshot.boards).toEqual([])
  })

  it('reads board issues by isLast when the page gives no total', async () => {
    const page = (url: URL) => (url.searchParams.get('startAt') === '0' ? answer({ isLast: false, issues: [{ key: 'BR-1' }] }) : answer({ isLast: true, issues: [{ key: 'BR-9' }] }))
    const { fetch } = fakeJira({ overrides: { '/rest/agile/1.0/board/11/issue': page } })
    const snapshot = await fetchJiraSnapshot(clientOf(fetch), [11], NOW)

    expect(snapshot.boardBugs).toEqual({ '11': ['BR-1', 'BR-9'] })
  })

  it('keeps the fields of a bug and nothing else', async () => {
    const { fetch } = fakeJira()
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs).toEqual([
      { key: 'BR-1', created: '2026-10-20T08:00:00.000+0200', status: 'In Progress', statusCategory: 'indeterminate', priority: 'High', featureArea: 'Grille_hebdomadaire', breached: true },
      { key: 'BR-2', created: '2026-09-30T08:00:00.000+0200', status: 'Done', statusCategory: 'done', priority: 'Low', featureArea: 'Planning', breached: false },
      { key: 'BR-4', created: '2026-10-28T08:00:00.000+0100', status: 'QA', statusCategory: 'done', priority: null, featureArea: null, breached: false },
    ])
  })

  it('takes the first Feature Area of an array', async () => {
    const { fetch } = fakeJira()
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs.find((b) => b.key === 'BR-2')?.featureArea).toBe('Planning')
  })

  it('takes the last completed cycle of the SLA when none is ongoing', async () => {
    const issue = {
      key: 'BR-7',
      fields: { created: '2026-10-01T00:00:00.000Z', status: { name: 'To Do' }, customfield_10632: { completedCycles: [{ breached: false }, { breached: true }] } },
    }
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/search/jql': () => answer({ issues: [issue], isLast: true }) } })
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs).toEqual([{ key: 'BR-7', created: '2026-10-01T00:00:00.000Z', status: 'To Do', statusCategory: 'undefined', priority: null, featureArea: null, breached: true }])
  })

  it('keeps a status without a known category as undefined, not as new', async () => {
    const issues = [
      { key: 'BR-7', fields: { created: 'x', status: { name: 'Odd', statusCategory: { key: 'undefined' } } } },
      { key: 'BR-8', fields: { created: 'x', status: { name: 'Odder' } } },
    ]
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/search/jql': () => answer({ issues, isLast: true }) } })
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs.map((b) => b.statusCategory)).toEqual(['undefined', 'undefined'])
  })

  it('drops excluded resolutions', async () => {
    const { fetch } = fakeJira()
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs.map((b) => b.key)).not.toContain('BR-3')
    expect(bugs.map((b) => b.key)).not.toContain('BR-5')
  })

  it('drops an issue without a key, a creation date or a status', async () => {
    const issues = [{ fields: { created: 'x', status: { name: 'To Do' } } }, { key: 'BR-8', fields: { status: { name: 'To Do' } } }, { key: 'BR-9', fields: { created: 'x' } }]
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/search/jql': () => answer({ issues, isLast: true }) } })
    const { bugs } = await fetchJiraSnapshot(clientOf(fetch), [], NOW)

    expect(bugs).toEqual([])
  })

  it('retries a 429 after Retry-After and not a 500', async () => {
    const sleeps: number[] = []
    const limited = fakeJira({ failures: [{ status: 429, headers: { 'Retry-After': '7' } }] })
    await fetchJiraSnapshot(clientOf(limited.fetch, sleeps), [], NOW)

    expect(sleeps).toEqual([7000])
    expect(limited.calls.slice(0, 2).map((c) => c.path)).toEqual(['/rest/api/3/myself', '/rest/api/3/myself'])

    const broken = fakeJira({ failures: [{ status: 500 }] })
    await expect(fetchJiraSnapshot(clientOf(broken.fetch, sleeps), [], NOW)).rejects.toThrow('HTTP 500')
    expect(broken.calls).toHaveLength(1)
    expect(sleeps).toEqual([7000])
  })

  it('gives up after 5 attempts on a 429 that keeps coming', async () => {
    const sleeps: number[] = []
    const { fetch } = fakeJira({ failures: Array.from({ length: 5 }, () => ({ status: 429 })) })

    await expect(fetchJiraSnapshot(clientOf(fetch, sleeps), [], NOW)).rejects.toThrow('HTTP 429 on every attempt')
    expect(sleeps).toEqual([2000, 3000, 5000, 9000])
  })

  it('never runs more than 4 requests at once', async () => {
    const { fetch, flight, calls } = fakeJira({ delayed: true, overrides: { '/rest/api/3/jql/autocompletedata/suggestions': fullSuggestions } })
    await fetchJiraSnapshot(clientOf(fetch), BOARD_IDS, NOW)

    expect(calls.length).toBeGreaterThan(100)
    expect(flight.peak).toBe(4)
  })

  it('names the call Jira refused', async () => {
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/status': () => answer({}, 403) } })

    await expect(fetchJiraSnapshot(clientOf(fetch), [], NOW)).rejects.toThrow('Jira refused GET /rest/api/3/status (HTTP 403)')
  })
})

describe('writeJiraSnapshot', () => {
  let root: string
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-snapshot-'))
  })
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const fetched = async (): Promise<JiraSnapshot> => fetchJiraSnapshot(clientOf(fakeJira().fetch), BOARD_IDS, NOW)

  it('writes one file per top-level key and reads them back, replacing an older run', async () => {
    const snapshot = await fetched()
    const dir = path.join(root, 'snaps', '2026-11-02')
    writeJiraSnapshot(dir, { ...snapshot, bugs: [] })

    writeJiraSnapshot(dir, snapshot)

    expect(fs.readdirSync(dir).sort()).toEqual(['boardBugs.json', 'boards.json', 'bugs.json', 'featureAreaLabels.json', 'meta.json', 'statuses.json'])
    expect(fs.readdirSync(path.dirname(dir))).toEqual(['2026-11-02'])
    expect(readJiraSnapshot(dir)).toEqual(snapshot)
  })

  it('refuses a snapshot whose file does not match the format, naming the file and the fetch to re-run', async () => {
    const snapshot = await fetched()
    const dir = path.join(root, '2026-11-02')
    writeJiraSnapshot(dir, snapshot)
    fs.writeFileSync(path.join(dir, 'bugs.json'), JSON.stringify(snapshot.bugs.map(({ breached: _, ...older }) => older)))

    expect(() => readJiraSnapshot(dir)).toThrow(SnapshotFormatError)
    expect(() => readJiraSnapshot(dir)).toThrow(`${path.join(dir, 'bugs.json')} does not match the Jira snapshot format`)
    expect(() => readJiraSnapshot(dir)).toThrow('Re-run `pnpm discover:jira:fetch` for a fresh snapshot.')
  })

  it.each([
    ['is missing', (file: string) => fs.rmSync(file), 'ENOENT'],
    ['holds no JSON', (file: string) => fs.writeFileSync(file, '{"from":'), 'JSON'],
  ])('refuses a snapshot whose file %s', async (_, damage, cause) => {
    const dir = path.join(root, '2026-11-02')
    writeJiraSnapshot(dir, await fetched())
    const file = path.join(dir, 'meta.json')
    damage(file)

    expect(() => readJiraSnapshot(dir)).toThrow(SnapshotFormatError)
    expect(() => readJiraSnapshot(dir)).toThrow(`${file} cannot be read:`)
    expect(() => readJiraSnapshot(dir)).toThrow(cause)
  })

  it('refuses a folder holding anything but a snapshot, leaving it intact', async () => {
    const snapshot = await fetched()
    fs.writeFileSync(path.join(root, 'notes.txt'), 'keep me')

    expect(() => writeJiraSnapshot(root, snapshot)).toThrow(`${root} holds files other than a Jira snapshot; nothing written`)
    expect(fs.readdirSync(root)).toEqual(['notes.txt'])
  })

  it('leaves no folder when a write fails', async () => {
    const snapshot = await fetched()
    const broken: JiraSnapshot = {
      ...snapshot,
      meta: {
        get fetchedAt(): string {
          throw new Error('unwritable')
        },
        host: 'jira.example.invalid',
      },
    }

    expect(() => writeJiraSnapshot(path.join(root, 'out'), broken)).toThrow('unwritable')
    expect(fs.readdirSync(root)).toEqual([])
  })
})

describe('runJiraFetchCli', () => {
  let root: string
  let printed: string[]
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-cli-'))
    printed = []
    const capture = (...args: unknown[]) => {
      printed.push(args.map(String).join(' '))
    }
    vi.spyOn(console, 'log').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 and leaves no folder on 401', async () => {
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/myself': unauthorized } })
    const out = path.join(root, 'snap')

    expect(await runJiraFetchCli(['--out', out], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('Jira refused the credentials (HTTP 401): use a classic API token without scopes')
    expect(fs.existsSync(out)).toBe(false)
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('reports a failure that is not a refusal and leaves no folder', async () => {
    const { fetch } = fakeJira({ overrides: { '/rest/api/3/status': () => answer({}, 500) } })

    expect(await runJiraFetchCli(['--out', path.join(root, 'snap')], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('Jira fetch failed: HTTP 500')
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('exits 1 and leaves a foreign --out folder intact', async () => {
    const { fetch } = fakeJira()
    const out = path.join(root, 'desktop')
    fs.mkdirSync(out)
    fs.writeFileSync(path.join(out, 'report.pdf'), 'keep me')

    expect(await runJiraFetchCli(['--out', out], ENV, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain(`${out} holds files other than a Jira snapshot; nothing written`)
    expect(fs.readdirSync(out)).toEqual(['report.pdf'])
  })

  it('names every missing variable', async () => {
    const { fetch } = fakeJira()

    expect(await runJiraFetchCli([], {}, fetch, NOW)).toBe(1)
    expect(printed).toEqual(['JIRA_EMAIL is not set', 'JIRA_API_TOKEN is not set'])
  })

  it.each(['JIRA_EMAIL', 'JIRA_API_TOKEN'])('names a missing %s', async (name) => {
    const { fetch, calls } = fakeJira()

    expect(await runJiraFetchCli([], { ...ENV, [name]: '' }, fetch, NOW)).toBe(1)
    expect(printed.join('\n')).toContain(`${name} is not set`)
    expect(calls).toHaveLength(0)
  })

  it('prints the help and calls nothing', async () => {
    const { fetch, calls } = fakeJira()

    expect(await runJiraFetchCli(['--help'], {}, fetch, NOW)).toBe(0)
    expect(printed.join('\n')).toContain('JIRA_API_TOKEN')
    expect(calls).toHaveLength(0)
  })

  it('keeps no summary, description, person or token', async () => {
    const { fetch } = fakeJira()
    const out = path.join(root, 'snap')

    expect(await runJiraFetchCli(['--out', out], ENV, fetch, NOW, BOARD_IDS)).toBe(0)
    expect(JSON.stringify(fixture('search-page-0'))).toMatch(SENTINEL)
    const written = fs.readdirSync(out).map((file) => fs.readFileSync(path.join(out, file), 'utf8')).join('\n')
    expect(written).not.toMatch(SENTINEL)
    expect(written).not.toContain(TOKEN)
    expect(written).not.toContain(EMAIL)
    const output = printed.join('\n')
    expect(output).not.toContain(TOKEN)
    expect(output).not.toContain(EMAIL)
    expect(output).not.toContain(Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64'))
    expect(fs.readdirSync(root)).toEqual(['snap'])
  })

  it('reads the host from JIRA_HOST, defaulting to the Skello site, and prints the calls and counts', async () => {
    const { fetch, calls } = fakeJira()
    const out = path.join(root, 'snap')

    await runJiraFetchCli(['--out', out], ENV, fetch, NOW, BOARD_IDS)
    await runJiraFetchCli(['--out', out], { ...ENV, JIRA_HOST: 'jira.example.invalid' }, fetch, NOW)

    expect(calls[0]?.host).toBe('skello.atlassian.net')
    expect(calls.at(-1)?.host).toBe('jira.example.invalid')
    const output = printed.join('\n')
    expect(output).toContain('GET /rest/api/3/myself')
    expect(output).toContain('GET /rest/agile/1.0/board/12/issue')
    expect(output).toContain('bugs 3, boards 2, statuses 5, feature area labels 3, board bugs 2 boards')
    expect(output).toContain(`snapshot written to ${out}`)
  })

  it('reports a rejection that is not an Error', async () => {
    const rejecting: typeof globalThis.fetch = () => Promise.reject('connection reset')

    expect(await runJiraFetchCli(['--out', path.join(root, 'snap')], ENV, rejecting, NOW)).toBe(1)
    expect(printed.join('\n')).toContain('Jira fetch failed: connection reset')
  })

  describe('without an output folder', () => {
    const LONG_AGO = new Date('2001-02-03T04:05:06Z')
    const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
    const dated = path.join(packageRoot, '.jira-snapshots', '2001-02-03')
    afterEach(() => {
      fs.rmSync(dated, { recursive: true, force: true })
    })

    it.each([[[]], [['--out']]])('writes to .jira-snapshots/<date> in the package (%j)', async (argv) => {
      const { fetch } = fakeJira()

      expect(await runJiraFetchCli(argv, ENV, fetch, LONG_AGO)).toBe(0)
      expect(printed.join('\n')).toContain(`snapshot written to ${dated}`)
      expect(readJiraSnapshot(dated).meta.fetchedAt).toBe(LONG_AGO.toISOString())
    })
  })
})
