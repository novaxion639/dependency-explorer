import { connectivityMap } from '@dependency-explorer/data'
import { runJiraFetchCli } from './jira/fetch-cli'

const boardIds = [...new Set((connectivityMap.teams ?? []).flatMap((team) => team.jiraBoards ?? []))]

process.exit(await runJiraFetchCli(process.argv.slice(2), process.env, globalThis.fetch, new Date(), boardIds))
