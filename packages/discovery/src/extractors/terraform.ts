/**
 * Terraform ground truth — the authoritative provisioning layer.
 *
 * Skello's estate is one `<service>-tf` repo per service (plus platform repos
 * like common-dms-tf). This extractor mines what a repo PROVABLY provisions:
 * owned data resources (DynamoDB tables, S3 buckets, Kinesis/Firehose streams,
 * RDS, Atlas clusters), DMS replication tasks/endpoints (the CDC backbone,
 * with engine names resolving direction), and data-plane IAM actions.
 *
 * Line-based literal mining like the serverless static scan — interpolations
 * (`${local.project}`) are kept raw; the repo name already identifies the
 * service, so names are context, not identity.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface TfResource {
  tfType: string
  /** terraform resource label (second quoted token) */
  label: string
  /** literal `name`/`bucket`/`identifier` inside the block when present */
  name?: string
}

export interface TfDmsTask {
  label: string
  taskId?: string
  migrationType?: string
  /** expression text of source/target endpoint refs — carries the engine hint */
  source?: string
  target?: string
}

export interface TfDmsEndpoint {
  label: string
  endpointId?: string
  endpointType?: string
  engineName?: string
}

export interface TerraformFacts {
  resources: TfResource[]
  dmsTasks: TfDmsTask[]
  dmsEndpoints: TfDmsEndpoint[]
  /** recognized data-plane IAM actions found in policy documents */
  iamActions: string[]
}

const OWNED_TF_TYPES = new Set([
  'aws_dynamodb_table',
  'aws_s3_bucket',
  'aws_kinesis_stream',
  'aws_kinesis_firehose_delivery_stream',
  'aws_rds_cluster',
  'aws_db_instance',
  'mongodbatlas_cluster',
])

const IAM_ACTION_RE = /"((?:dynamodb|s3|kinesis|firehose):[A-Za-z*][A-Za-z*]*)"/g

function attr(block: string, key: string): string | undefined {
  const m = block.match(new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]+)"|([^\\n]+))`))
  if (!m) return undefined
  return (m[1] ?? m[2])?.trim()
}

/** Parse one .tf file's content. Exported for tests. */
export function parseTerraform(content: string): TerraformFacts {
  const resources: TfResource[] = []
  const dmsTasks: TfDmsTask[] = []
  const dmsEndpoints: TfDmsEndpoint[] = []
  const iamActions = new Set<string>()

  const resourceRe = /^resource\s+"([a-z0-9_]+)"\s+"([A-Za-z0-9_-]+)"\s*\{/gm
  let m: RegExpExecArray | null
  while ((m = resourceRe.exec(content))) {
    const [, tfType, label] = m
    // block ends at the next top-level resource — attribute regexes must
    // never bleed into a neighbouring block's identically-named attributes
    const nextResource = content.indexOf('\nresource ', m.index + 1)
    const block = content.slice(m.index, nextResource === -1 ? m.index + 1600 : Math.min(nextResource, m.index + 1600))
    if (OWNED_TF_TYPES.has(tfType!)) {
      const name = attr(block, 'name') ?? attr(block, 'bucket') ?? attr(block, 'identifier')
      resources.push({ tfType: tfType!, label: label!, ...(name ? { name } : {}) })
    } else if (tfType === 'aws_dms_replication_task') {
      dmsTasks.push({
        label: label!,
        taskId: attr(block, 'replication_task_id'),
        migrationType: attr(block, 'migration_type'),
        source: attr(block, 'source_endpoint_arn'),
        target: attr(block, 'target_endpoint_arn'),
      })
    } else if (tfType === 'aws_dms_endpoint') {
      dmsEndpoints.push({
        label: label!,
        endpointId: attr(block, 'endpoint_id'),
        endpointType: attr(block, 'endpoint_type'),
        engineName: attr(block, 'engine_name'),
      })
    }
  }

  let a: RegExpExecArray | null
  while ((a = IAM_ACTION_RE.exec(content))) iamActions.add(a[1]!)

  return { resources, dmsTasks, dmsEndpoints, iamActions: [...iamActions].sort() }
}

/** Scan a `<service>-tf` sibling checkout. Null when absent or empty. */
export function extractTerraform(repoBase: string, tfRepo: string): TerraformFacts | null {
  const repoPath = path.join(repoBase, tfRepo)
  let entries: string[]
  try {
    entries = fs.readdirSync(repoPath).filter(f => f.endsWith('.tf'))
  } catch {
    return null
  }
  if (!entries.length) return null

  const merged: TerraformFacts = { resources: [], dmsTasks: [], dmsEndpoints: [], iamActions: [] }
  const actions = new Set<string>()
  for (const file of entries) {
    let content: string
    try {
      content = fs.readFileSync(path.join(repoPath, file), 'utf-8')
    } catch {
      continue
    }
    const facts = parseTerraform(content)
    merged.resources.push(...facts.resources)
    merged.dmsTasks.push(...facts.dmsTasks)
    merged.dmsEndpoints.push(...facts.dmsEndpoints)
    facts.iamActions.forEach(x => actions.add(x))
  }
  merged.iamActions = [...actions].sort()
  if (!merged.resources.length && !merged.dmsTasks.length && !merged.dmsEndpoints.length && !merged.iamActions.length) return null
  return merged
}
