import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Resource } from '@dependency-explorer/schema'
import { cdcRelations, cdcTables, consumerRelations, terraformList } from './cdc'
import { parseTerraform } from './extractors/terraform'

const LOCALS = ['locals {', '  # tables replicated by CDC', '  dms_tables = [', '    "shifts",', '    "postes",', '    "postes_weekly_options",', '    "audits",', '  ]', '}'].join('\n')
const TEMPLATE = '{ "rules": ${jsonencode([for idx, rule in flatten([for table in dms_tables : [{ "object-locator" = { "table-name" = table } }]]) : rule])} }'
const files: Record<string, string> = {
  'configs/table_mappings.tftpl': TEMPLATE,
  'configs/one.json': JSON.stringify({ rules: [{ 'rule-type': 'selection', 'object-locator': { 'schema-name': 'public', 'table-name': 'prospects' }, 'rule-action': 'include' }] }),
}
const read = (p: string) => files[p] ?? null

describe('cdcTables', () => {
  it('reads the template loop variable back to the locals list', () => {
    const task = { label: 'skelloapp_aurora', migrationType: 'cdc', tableMappings: 'templatefile("./configs/table_mappings.tftpl", { workspace = local.workspace dms_tables = local.dms_tables })' }
    expect(cdcTables(task, read, [LOCALS], [])).toEqual(['shifts', 'postes', 'postes_weekly_options', 'audits'])
  })
  it('reads selection rules from a file() mapping', () => {
    expect(cdcTables({ label: 'p', tableMappings: 'file("${path.module}/configs/one.json")' }, read, [], [])).toEqual(['prospects'])
  })
  it('keeps only include selection rules of a file() mapping', () => {
    const rule = (type: string, action: string, table: string) => ({ 'rule-type': type, 'rule-action': action, 'object-locator': { 'schema-name': 'public', 'table-name': table } })
    const mixed = { rules: [rule('selection', 'include', 'kept'), rule('selection', 'exclude', 'dropped'), rule('transformation', 'rename', 'renamed')] }
    expect(cdcTables({ label: 'p', tableMappings: 'file("mixed.json")' }, p => (p === 'mixed.json' ? JSON.stringify(mixed) : null), [], [])).toEqual(['kept'])
  })
  it('keeps only include selection rules when a mapping is not valid JSON', () => {
    const body = '{ "rules": [ { "rule-type" = "selection", "rule-action" = "include", "object-locator" = { "table-name" = "kept" } }, { "rule-type" = "selection", "rule-action" = "exclude", "object-locator" = { "table-name" = "dropped" } }, { "rule-type" = "selection", "rule-action" = "include", "object-locator" = { "table-name" = "%" } } ] ${x} }'
    expect(cdcTables({ label: 'p', tableMappings: 'templatefile("m.tftpl", {})' }, () => body, [], ['a', 'b'])).toEqual(['a', 'b'])
    expect(cdcTables({ label: 'p', tableMappings: 'templatefile("m.tftpl", {})' }, () => body.replace('"%"', '"also"'), [], ['a'])).toEqual(['kept', 'also'])
  })
  it('lists a terraform local array, skipping comment lines', () => {
    expect(terraformList([LOCALS], 'dms_tables')).toHaveLength(4)
  })
})

describe('consumerRelations', () => {
  const stream = { id: 'kinesis:skelloapp-bus', name: 'skelloapp-bus' }
  const tables = ['shifts', 'postes', 'postes_weekly_options']
  it('credits every table a prefix covers, a dotless prefix included, and skips disabled sources', () => {
    const serverless = new Map([
      ['svc-workload-plan', [{ stream: 'skelloapp-bus', kind: 'kinesis' as const, raw: 'x', tablePrefixes: ['public.postes', 'public.shifts.'], file: 'serverless/functions/kinesis.ts' }]],
      ['svc-punch', [{ stream: 'skelloapp-bus', kind: 'kinesis' as const, raw: 'x', tablePrefixes: ['public.shifts.'], enabled: false }]],
    ])
    expect(consumerRelations(stream, tables, serverless).map(r => `${r.resource} ${r.service} ${r.file ?? '-'}`)).toEqual([
      'pg:skello_production.shifts svc-workload-plan serverless/functions/kinesis.ts',
      'pg:skello_production.postes svc-workload-plan serverless/functions/kinesis.ts',
      'pg:skello_production.postes_weekly_options svc-workload-plan serverless/functions/kinesis.ts',
    ])
  })
})

const DMS_TF = (source: string, extra: string, count = '1') => `
resource "aws_kinesis_stream" "bus" {
  name = "skelloapp-bus"
}
resource "aws_dms_endpoint" "kinesis_stream_endpoint" {
  endpoint_id = "kinesis"
  endpoint_type = "target"
  stream_arn = aws_kinesis_stream.bus.arn
}
resource "aws_dms_replication_task" "x" {
  count = ${count}
  replication_task_id = "x"
  migration_type = "${extra}"
  source_endpoint_arn = aws_dms_endpoint.${source}.endpoint_arn
  target_endpoint_arn = aws_dms_endpoint.kinesis_stream_endpoint.endpoint_arn
  table_mappings = templatefile("./configs/t.tftpl", {
    dms_tables = local.dms_tables
  })
}
`

describe('cdcRelations', () => {
  const bus: Resource = { id: 'kinesis:skelloapp-bus', kind: 'stream', store: 'kinesis', name: 'skelloapp-bus', evidence: [] }
  const consumer = { stream: 'skelloapp-bus', kind: 'kinesis' as const, raw: 'x', tablePrefixes: ['public.shifts.'], file: 'serverless/kinesis.ts' }
  const serverless = new Map([['svc-workload-plan', { endpoints: [], queueNames: [], streamConsumers: [consumer], s3Triggers: [], schedules: [], ownedResources: [], dlqWirings: [], authorizerNames: [], sqsConsumers: null, source: 'static-scan' as const }]])
  const run = (dms: string, schemaTables = ['shifts', 'postes']) => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cdc-'))
    const dir = path.join(base, 'tf-infra')
    fs.mkdirSync(path.join(dir, 'configs'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dms.tf'), dms)
    fs.writeFileSync(path.join(dir, 'locals.tf'), LOCALS.replace('"audits",', '"audits",\n    "ar_internal_metadata",'))
    fs.writeFileSync(path.join(dir, 'configs/t.tftpl'), TEMPLATE)
    const facts = parseTerraform(dms)
    return cdcRelations({ terraform: [{ service: 'tf-infra', tfRepo: 'tf-infra', facts }], resources: [bus], serverless, schemaTables, repoBase: base })
  }

  it('feeds every schema table of a monolith cdc task, credits consumers and reports unknown tables once', () => {
    const { relations, findings } = run(DMS_TF('skelloapp_aurora', 'cdc') + DMS_TF('skelloapp_aurora', 'cdc').replace('replication_task_id = "x"', 'replication_task_id = "y"'), ['shifts', 'postes', 'postes_weekly_options'])
    expect(relations.filter(r => r.relation === 'feeds').map(r => r.resource)).toEqual(['shifts', 'postes', 'postes_weekly_options', 'shifts', 'postes', 'postes_weekly_options'].map(t => `pg:skello_production.${t}`))
    expect(relations.filter(r => r.relation === 'consumes').map(r => `${r.resource} ${r.service} ${r.target}`)).toEqual(['pg:skello_production.shifts svc-workload-plan kinesis:skelloapp-bus', 'pg:skello_production.shifts svc-workload-plan kinesis:skelloapp-bus'])
    expect(findings).toEqual([{ kind: 'cdc-unknown-table', subject: 'audits', detail: 'tf-infra:x selects audits, absent from db/schema.rb' }])
  })
  it('skips a count = 0 task', () => {
    expect(run(DMS_TF('skelloapp_aurora', 'cdc', '0')).relations).toEqual([])
  })
  it('skips a full-load task', () => {
    expect(run(DMS_TF('skelloapp_aurora', 'full-load')).relations).toEqual([])
  })
  it('skips a task sourced from another database', () => {
    expect(run(DMS_TF('other_db', 'cdc')).relations).toEqual([])
  })
})

describe('parseTerraform dms task attributes', () => {
  it('captures count and a multi-line templatefile expression', () => {
    const [task] = parseTerraform(DMS_TF('skelloapp_aurora', 'cdc', '0')).dmsTasks
    expect(task?.count).toBe('0')
    expect(task?.tableMappings).toBe('templatefile("./configs/t.tftpl", {\n    dms_tables = local.dms_tables\n  })')
  })
})
