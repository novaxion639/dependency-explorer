import { runFetchCli } from './datadog/fetch-cli'

process.exit(await runFetchCli(process.argv.slice(2), process.env, globalThis.fetch))
