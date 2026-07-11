/**
 * Application-code AWS client usage — the produce/read-write direction that
 * serverless event bindings (inbound) cannot see.
 *
 * Registry-driven like sdk-usage.ts: each resource kind has import signals
 * (raw @aws-sdk packages, @skelloapp/aws-sdk-lib wrappers, dynamodb-toolbox,
 * TypeORM) and operation signals (method calls / command classes). Operations
 * only count in files that carry the kind's import, so a `.putRecords(` on an
 * unrelated client never fabricates a Kinesis producer.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export type AwsUsageKind = 'kinesis' | 'firehose' | 's3' | 'dynamodb' | 'postgresql'

export interface AwsUsageFact {
  kind: AwsUsageKind
  /** operations proven by call sites: produce, read, write, delete, presign, query, update, entity */
  operations: string[]
  /** representative files (capped) */
  files: string[]
  /** total files carrying the kind's import */
  fileCount: number
}

interface KindSignals {
  imports: RegExp
  operations: Record<string, RegExp>
}

const REGISTRY: Record<AwsUsageKind, KindSignals> = {
  kinesis: {
    imports: /@aws-sdk\/client-kinesis|\bAwsKinesisClient\b/,
    operations: { produce: /\.putRecords?\(|PutRecords?Command/ },
  },
  firehose: {
    imports: /@aws-sdk\/client-firehose|\bAwsFirehoseClient\b/,
    operations: { produce: /\.putRecordBatch\(|PutRecordBatchCommand/ },
  },
  s3: {
    imports: /@aws-sdk\/client-s3|\bAwsS3Client\b/,
    operations: {
      read: /\.getObject\(|GetObjectCommand/,
      write: /\.putObject\(|PutObjectCommand|new Upload\(/,
      delete: /\.deleteObject\(|DeleteObjectCommand/,
      presign: /getSignedUrl/,
    },
  },
  dynamodb: {
    imports: /dynamodb-toolbox|@aws-sdk\/(?:client-dynamodb|lib-dynamodb)/,
    operations: {
      read: /GetItemCommand|\bGetCommand\b/,
      query: /\bQueryCommand\b|\bScanCommand\b/,
      write: /PutItemCommand|\bPutCommand\b/,
      update: /UpdateItemCommand|\bUpdateCommand\b/,
      delete: /DeleteItemCommand|\bDeleteCommand\b/,
    },
  },
  postgresql: {
    imports: /from ['"]typeorm['"]/,
    operations: { entity: /@Entity\(/ },
  },
}

/** Classify one source file's AWS usage. Exported for tests. */
export function classifyAwsUsage(content: string): Array<{ kind: AwsUsageKind; operations: string[] }> {
  const out: Array<{ kind: AwsUsageKind; operations: string[] }> = []
  for (const [kind, signals] of Object.entries(REGISTRY) as Array<[AwsUsageKind, KindSignals]>) {
    if (!signals.imports.test(content)) continue
    const operations = Object.entries(signals.operations)
      .filter(([, re]) => re.test(content))
      .map(([op]) => op)
    out.push({ kind, operations })
  }
  return out
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSourceFiles(full, out)
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

const FILE_SAMPLE_CAP = 4

/**
 * Scan a lambda repo's src/ tree. Returns null when the repo has no
 * serverless config (browser apps and the Rails monolith are out of scope —
 * they don't hold AWS SDK clients this registry describes).
 */
export function extractAwsClients(repoBase: string, repo: string): AwsUsageFact[] | null {
  const repoPath = path.join(repoBase, repo)
  const isLambdaRepo = fs.existsSync(path.join(repoPath, 'serverless.ts'))
    || fs.existsSync(path.join(repoPath, 'serverless'))
  if (!isLambdaRepo) return null

  const srcPath = path.join(repoPath, 'src')
  if (!fs.existsSync(srcPath)) return null

  const byKind = new Map<AwsUsageKind, { operations: Set<string>; files: string[] }>()
  for (const file of walkSourceFiles(srcPath)) {
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    for (const { kind, operations } of classifyAwsUsage(content)) {
      const agg = byKind.get(kind) ?? { operations: new Set<string>(), files: [] }
      operations.forEach(op => agg.operations.add(op))
      agg.files.push(path.relative(repoPath, file))
      byKind.set(kind, agg)
    }
  }

  if (!byKind.size) return null
  return [...byKind.entries()].map(([kind, agg]) => ({
    kind,
    operations: [...agg.operations].sort(),
    files: agg.files.slice(0, FILE_SAMPLE_CAP),
    fileCount: agg.files.length,
  }))
}
