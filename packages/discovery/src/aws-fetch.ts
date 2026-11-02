/**
 * Fetches an AWS live-verification snapshot into a directory the aws-live
 * extractor can analyze (read-only List/Describe/Get calls, ~215 requests).
 *
 * Usage (an MFA'd session must already be cached — run
 * `aws sts get-caller-identity --profile <profile>` in a terminal first):
 *
 *   pnpm discover:aws:fetch --profile skl-sandbox [--out .aws-snapshots/<date>]
 *
 * Snapshots contain account IDs and resource ARNs — the output directory is
 * gitignored and must stay out of the repository.
 */

import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { fetchAwsSnapshot } from './aws-snapshot'

const argv = process.argv
const arg = (flag: string): string | null => {
  const value = argv[argv.indexOf(flag) + 1]
  return argv.includes(flag) && value ? value : null
}

const profile = arg('--profile')
if (!profile) {
  console.error('usage: pnpm discover:aws:fetch --profile <aws-profile> [--out <dir>]')
  process.exit(1)
}

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = arg('--out') ?? path.join(pkgRoot, '.aws-snapshots', new Date().toISOString().slice(0, 10))

let calls = 0
const aws = (args: string[]): unknown => {
  calls++
  return JSON.parse(execFileSync('aws', [...args, '--profile', profile], { maxBuffer: 64 * 1024 * 1024 }).toString() || '{}')
}

console.error(`fetching read-only snapshot with profile ${profile} → ${outDir}`)
fetchAwsSnapshot(aws, outDir, (label) => console.error(`  ✓ ${label}`))
console.error(`done — ${calls} read-only calls. Analyze with: pnpm discover -- --aws ${outDir}`)
