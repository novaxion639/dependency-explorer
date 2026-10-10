import { describe, it, expect } from 'vitest'
import { cdcTables, consumerRelations, terraformList } from './cdc'

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
