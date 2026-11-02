import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runDraftCli, snapshotDirOf } from './draft-cli'
import { writeJiraSnapshot, type JiraSnapshot } from './snapshot'

const bug = (key: string, featureArea: string | null, status: string, statusCategory: JiraSnapshot['bugs'][number]['statusCategory']): JiraSnapshot['bugs'][number] => ({
  key,
  created: '2026-10-01T08:00:00.000+0200',
  status,
  statusCategory,
  priority: null,
  featureArea,
  breached: false,
})

const snapshot: JiraSnapshot = {
  meta: { fetchedAt: '2026-11-02T10:30:00.000Z', host: 'example.invalid' },
  featureAreaLabels: ['Staff needs', 'Grille_hebdomadaire', "Shifts \"beta\" it's a \\ test", 'Smart Planner', 'Staffing requirements'],
  statuses: ['To Do', 'QA', 'Done'],
  boards: [],
  bugs: [
    bug('BR-1', 'Staff needs', 'In Progress', 'indeterminate'),
    bug('BR-2', 'Staff needs', 'QA', 'done'),
    bug('BR-3', 'Staff needs', 'Done', 'done'),
    bug('BR-4', 'Only on bugs', 'To Do', 'new'),
    bug('BR-5', 'Only on bugs', 'Weird', 'undefined'),
    bug('BR-6', null, 'To Do', 'new'),
  ],
  boardBugs: {},
}

describe('runDraftCli', () => {
  let root: string
  let out: string[]
  let err: string[]

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-draft-'))
    out = []
    err = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => void out.push(line))
    vi.spyOn(console, 'error').mockImplementation((line: string) => void err.push(line))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('prints one draft row per label with its open count', async () => {
    const dir = path.join(root, '2026-11-02')
    writeJiraSnapshot(dir, snapshot)
    expect(await runDraftCli([], dir)).toBe(0)
    expect(out).toEqual([
      "{ label: 'Staff needs', tribe: 'Scheduling', area: null }, // catalog: Staff needs, 2 open BRs",
      "{ label: 'Staffing requirements', tribe: 'Scheduling', area: null }, // catalog: Staff needs, 0 open BRs",
      "{ label: 'Grille_hebdomadaire', tribe: null, area: null }, // catalog: none, 0 open BRs",
      "{ label: 'Only on bugs', tribe: null, area: null }, // catalog: none, 2 open BRs",
      "{ label: 'Shifts \"beta\" it\\'s a \\\\ test', tribe: null, area: null }, // catalog: none, 0 open BRs",
      "{ label: 'Smart Planner', tribe: null, area: null }, // catalog: Smart Planner, 0 open BRs",
    ])
    expect(err).toEqual([])
  })

  it('exits 1 naming the fetch script when the snapshot is missing', async () => {
    expect(await runDraftCli([], path.join(root, 'nowhere'))).toBe(1)
    expect(err.join('\n')).toContain('pnpm discover:jira:fetch')
    expect(out).toEqual([])
  })

  it('exits 1 naming the fetch script when there is no snapshot folder', async () => {
    expect(await runDraftCli([], null)).toBe(1)
    expect(err.join('\n')).toContain('pnpm discover:jira:fetch')
  })

  it('prints usage on --help', async () => {
    expect(await runDraftCli(['--help'], null)).toBe(0)
    expect(out.join('\n')).toContain('discover:jira:draft')
  })
})

describe('snapshotDirOf', () => {
  let home: string
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-home-'))
  })
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }))

  it('takes --snapshot first', () => {
    expect(snapshotDirOf(['--snapshot', 'some/dir'], home)).toBe(path.resolve('some/dir'))
  })

  it('takes the latest dated folder otherwise', () => {
    fs.mkdirSync(path.join(home, '2026-10-01'))
    fs.mkdirSync(path.join(home, '2026-11-02'))
    fs.writeFileSync(path.join(home, '2026-12-31'), '')
    expect(snapshotDirOf([], home)).toBe(path.join(home, '2026-11-02'))
  })

  it('returns null when there is none', () => {
    expect(snapshotDirOf([], home)).toBeNull()
    expect(snapshotDirOf([], path.join(home, 'absent'))).toBeNull()
  })
})
