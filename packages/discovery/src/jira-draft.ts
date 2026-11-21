import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDraftCli } from './jira/draft-cli'

const home = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.jira-snapshots')

process.exit(await runDraftCli(process.argv.slice(2), home))
