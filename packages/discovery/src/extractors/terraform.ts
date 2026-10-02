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
  engine?: string
  forEach?: string
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
  'aws_sqs_queue',
  'aws_sns_topic',
])

const MODULE_STORES: Record<string, { tfType: string; attr: string }> = {
  'dynamodb-table': { tfType: 'aws_dynamodb_table', attr: 'name' },
  's3-bucket': { tfType: 'aws_s3_bucket', attr: 'bucket' },
  sqs: { tfType: 'aws_sqs_queue', attr: 'name' },
  sns: { tfType: 'aws_sns_topic', attr: 'name' },
  'rds-aurora': { tfType: 'aws_rds_cluster', attr: 'name' },
  elasticache: { tfType: 'aws_elasticache_replication_group', attr: 'replication_group_id' },
}
const ENGINE_TYPES = new Set(['aws_rds_cluster', 'aws_db_instance'])

const IAM_ACTION_RE = /"((?:dynamodb|s3|kinesis|firehose):[A-Za-z*][A-Za-z*]*)"/g

function attr(block: string, key: string): string | undefined {
  const m = block.match(new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]+)"|([^\\n]+))`))
  if (!m) return undefined
  return (m[1] ?? m[2])?.trim()
}

function topLevelAttr(block: string, key: string): string | undefined {
  const m = block.match(new RegExp(`^ {2}${key}\\s*=\\s*(?:"([^"]+)"|([^\\n]+))`, 'm'))
  return (m?.[1] ?? m?.[2])?.trim()
}

function blockAt(content: string, start: number): string {
  const end = content.slice(start).search(/^\}/m)
  return end === -1 ? content.slice(start) : content.slice(start, start + end + 1)
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
      const engine = ENGINE_TYPES.has(tfType ?? '') ? attr(block, 'engine') : undefined
      resources.push({ tfType: tfType!, label: label!, ...(name ? { name } : {}), ...(engine ? { engine } : {}) })
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

  for (const mod of content.matchAll(/^module\s+"([\w-]+)"\s*\{/gm)) {
    const block = blockAt(content, mod.index)
    const kind = block.match(/^ {2}source\s*=\s*"terraform-aws-modules\/([\w-]+)\/aws"/m)?.[1]
    const store = kind ? MODULE_STORES[kind] : undefined
    const name = store ? topLevelAttr(block, store.attr) : undefined
    if (store && name && mod[1]) {
      const engine = topLevelAttr(block, 'engine')
      resources.push({ tfType: store.tfType, label: mod[1], name, ...(engine ? { engine } : {}) })
    }
  }

  let a: RegExpExecArray | null
  while ((a = IAM_ACTION_RE.exec(content))) iamActions.add(a[1]!)

  return { resources, dmsTasks, dmsEndpoints, iamActions: [...iamActions].sort() }
}

const IDENTITY_LOCALS = new Set(['project', 'project_kebab_case', 'projectCamelCase', 'application', 'comp'])
const MAX_LOCAL_DEPTH = 4
const BARE_LOCAL = /^local\.(\w+)$/
const CASE_CALL = /^(lower|upper)\(\s*(.*?)\s*\)$/

export function parseTerraformLocals(content: string): Record<string, string> {
  const locals: Record<string, string> = {}
  for (const block of content.matchAll(/^locals\s*\{([\s\S]*?)^\}/gm)) {
    for (const m of (block[1] ?? '').matchAll(/^ {2}(\w+)\s*=\s*(?:"([^"]*)"|local\.(\w+))\s*(?:#.*)?$/gm)) {
      const value = m[2] ?? (m[3] ? `\${local.${m[3]}}` : undefined)
      if (m[1] && value) {
        locals[m[1]] = value
      }
    }
  }
  return locals
}

function changeCase(value: string, fn: 'lower' | 'upper'): string {
  return value.replace(/(\$\{[^}]*\})|([^$]+)/g, (part, template: string | undefined) => (template ? template : fn === 'lower' ? part.toLowerCase() : part.toUpperCase()))
}

export function applyTerraformLocals(value: string, locals: Record<string, string>, depth = 0): string {
  const call = value.match(CASE_CALL)
  if (call?.[1] === 'lower' || call?.[1] === 'upper') {
    return changeCase(applyTerraformLocals((call[2] ?? '').replace(/^"|"$/g, ''), locals, depth), call[1])
  }
  const bare = value.match(BARE_LOCAL)?.[1]
  if (bare) {
    const resolved = locals[bare]
    return resolved === undefined || depth >= MAX_LOCAL_DEPTH ? value : applyTerraformLocals(resolved, locals, depth + 1)
  }
  return value.replace(/\$\{local\.(\w+)\}/g, (whole, key: string) => {
    const resolved = locals[key]
    if (resolved === undefined || depth >= MAX_LOCAL_DEPTH || !(IDENTITY_LOCALS.has(key) || resolved.includes('${'))) {
      return whole
    }
    return applyTerraformLocals(resolved, locals, depth + 1)
  })
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
  const locals = Object.assign({}, ...entries.map(file => {
    try {
      return parseTerraformLocals(fs.readFileSync(path.join(repoPath, file), 'utf-8'))
    } catch {
      return {}
    }
  }))
  merged.resources = merged.resources.map(r => ({
    ...r,
    ...(r.name ? { name: applyTerraformLocals(r.name, locals) } : {}),
    ...(r.engine ? { engine: applyTerraformLocals(r.engine, locals) } : {}),
  }))
  merged.iamActions = [...actions].sort()
  if (!merged.resources.length && !merged.dmsTasks.length && !merged.dmsEndpoints.length && !merged.iamActions.length) return null
  return merged
}
