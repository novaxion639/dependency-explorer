import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDraftCli, snapshotDirOf } from './jira/draft-cli'

const argv = process.argv.slice(2)
const home = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.jira-snapshots')

process.exit(await runDraftCli(argv, snapshotDirOf(argv, home)))
