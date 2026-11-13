import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { jiraClient, Refused } from './client'
import { fetchJiraSnapshot, writeJiraSnapshot } from './snapshot'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_HOST = 'skello.atlassian.net'

const HELP = `usage: pnpm discover:jira:fetch [--out <dir>]

Reads a Jira snapshot into packages/discovery/.jira-snapshots/<YYYY-MM-DD>/ (or --out).
Environment: JIRA_EMAIL, JIRA_API_TOKEN (a classic API token without scopes), JIRA_HOST (default ${DEFAULT_HOST}).
Read-only: GET calls only.`

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const requestLine = (input: Parameters<typeof fetch>[0]): string => `GET ${new URL(new Request(input).url).pathname}`

export async function runJiraFetchCli(
  argv: string[],
  env: Record<string, string | undefined>,
  fetch: typeof globalThis.fetch,
  now = new Date(),
  boardIds: number[] = [],
): Promise<number> {
  let flags: { help?: boolean; out?: string }
  try {
    flags = parseArgs({ args: argv, options: { help: { type: 'boolean' }, out: { type: 'string' } } }).values
  } catch (e) {
    console.error(`${messageOf(e)}\n\n${HELP}`)
    return 1
  }
  if (flags.help) {
    console.log(HELP)
    return 0
  }
  const email = env.JIRA_EMAIL
  const token = env.JIRA_API_TOKEN
  if (!email || !token) {
    for (const name of [email ? null : 'JIRA_EMAIL', token ? null : 'JIRA_API_TOKEN'].filter((n) => n !== null)) {
      console.error(`${name} is not set`)
    }
    return 1
  }
  const outDir = path.resolve(flags.out || path.join(PACKAGE_ROOT, '.jira-snapshots', now.toISOString().slice(0, 10)))

  const logged: typeof globalThis.fetch = (input, init) => {
    console.error(`  ${requestLine(input)}`)
    return fetch(input, init)
  }
  let snapshot: Awaited<ReturnType<typeof fetchJiraSnapshot>>
  try {
    snapshot = await fetchJiraSnapshot(jiraClient({ fetch: logged, host: env.JIRA_HOST || DEFAULT_HOST, email, token }), boardIds, now)
  } catch (e) {
    console.error(e instanceof Refused ? e.message : `Jira fetch failed: ${messageOf(e)}`)
    return 1
  }
  try {
    writeJiraSnapshot(outDir, snapshot)
  } catch (e) {
    console.error(messageOf(e))
    return 1
  }
  console.error(
    `bugs ${snapshot.bugs.length}, boards ${snapshot.boards.length}, statuses ${snapshot.statuses.length}, ` +
      `feature area labels ${snapshot.featureAreaLabels.length}, board bugs ${Object.keys(snapshot.boardBugs).length} boards`,
  )
  console.error(`snapshot written to ${outDir}`)
  return 0
}
