/**
 * Discovery — scans local Skello repo checkouts and reconciles them with the
 * dependency map (ADR-0004, ADR-0007).
 *
 * Usage (from the workspace root):
 *   pnpm discover                 # classified drift report (markdown)
 *   pnpm discover:json            # same, as JSON
 *   pnpm discover:apply           # also write packages/data/src/generated/discovered.json
 *
 * Evidence sources (Phase 1 + 1.5):
 *   - package.json SDK dependencies (TypeScript repos)
 *   - Rails monolith client classes (app/services/microservices)
 *   - serverless config: deploy state (.serverless/) or static literal scan
 *   - frontend env service URLs + usage sites (names only, never values)
 *   - queue-name literals cross-referenced sender → consumer (async/SQS)
 *   - CODEOWNERS team slugs (ownership via curated mapping only)
 *
 * SDK presence is evidence of a dependency, not proof of runtime calls —
 * verified facts carry provenance instead of silently becoming truth.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectivityMap, resourceSurface } from '@dependency-explorer/data'
import { ListenerSurfaceSchema } from '@dependency-explorer/schema'
import { IGNORED_SDKS } from './mapping'
import { applyModeError } from './pinned'
import { machineSection } from './state-machines-report'
import { listenerSection } from './listeners-report'
import { datadogSection } from './extractors/datadog'
import { findingKeys, diffBaseline, readBaseline, readBaselineRepos, unscannedRepos, writeBaseline } from './baseline'
import { runDiscovery, writeOutputs, PinError, type Dataset, type DiscoveryOptions, type Report } from './discovery-run'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_BASE = path.resolve(__dirname, '../../../../')
const PINNED_MODE = process.argv.includes('--pinned')
const PINNED_BASE = path.resolve(__dirname, '../../../.pinned')

const MODE_ERROR = applyModeError(process.argv)
if (MODE_ERROR) {
  console.error(MODE_ERROR)
  process.exit(2)
}

const JSON_MODE = process.argv.includes('--json')
const BASELINE_PATH = path.resolve(__dirname, '../baseline.json')
const BASELINE_MODE = process.argv.includes('--write-baseline')
const FAIL_ON_NEW = process.argv.includes('--fail-on-new')
const APPLY_MODE = process.argv.includes('--apply')
function resolveSnapshotDir(flag: string, folder: string, fetchScript: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0) {
    return null
  }
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const given = process.argv[i + 1]
  if (given && !given.startsWith('--')) {
    for (const base of [process.cwd(), path.resolve(pkgRoot, '../..'), pkgRoot]) {
      const candidate = path.resolve(base, given)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
    throw new Error(`${flag} snapshot directory not found: ${given}`)
  }
  const home = path.join(pkgRoot, folder)
  const latest = fs.existsSync(home)
    ? fs.readdirSync(home, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort().pop()
    : undefined
  if (!latest) {
    throw new Error(`${flag} given but no snapshot found under ${home} — run pnpm ${fetchScript} first`)
  }
  return path.join(home, latest)
}
const AWS_SNAPSHOT_DIR = resolveSnapshotDir('--aws', '.aws-snapshots', 'discover:aws:fetch')
const DATADOG_SNAPSHOT_DIR = resolveSnapshotDir('--datadog', '.datadog-snapshots', 'discover:datadog:fetch')
const OUT_DIR = path.resolve(__dirname, '../../data/src/generated')
const LISTENERS_PATH = path.join(OUT_DIR, 'listeners.json')
const REPO_BASE = PINNED_MODE ? PINNED_BASE : SOURCE_BASE
const NOW = process.env.DE_FIXED_NOW ? new Date(process.env.DE_FIXED_NOW) : new Date()

// ── Report ────────────────────────────────────────────────────────────────────

function printMarkdown(r: Report, unscanned: string[]) {
  const section = (title: string, lines: string[]) => {
    console.log(`\n## ${title} (${lines.length})\n`)
    console.log(lines.length ? lines.join('\n') : '_none_')
  }

  console.log('# Discovery Report')
  if (r.pinned) {
    console.log(`\n## 📌 Pinned to production branches (${r.pinned.repos.length} repos)\n`)
    console.log(r.pinned.repos.map(p => `- ${p.repo} @ ${p.branch} ${p.sha.slice(0, 12)}`).join('\n'))
    if (r.pinned.skipped.length) {
      console.log(`\nSkipped:\n${r.pinned.skipped.map(s => `- ${s.repo} — ${s.reason}`).join('\n')}`)
    }
  } else {
    console.log('\n> unpinned — local working trees (run with --pinned for production branches)\n')
  }
  console.log(`\nScanned ${r.scannedRepos.length} repos in ${REPO_BASE}`)

  const verified = Object.entries(r.connectionEvidence)
  section('✅ Verified connections — in map, evidence found',
    verified.map(([key, ev]) => `- ${key.replace('→', ' → ')} _(${ev.join('; ')})_`))

  section('🆕 Candidates — evidence in code, missing from map (adopt via PR)',
    r.candidates.map(c => `- **${c.from} → ${c.to}** (${c.transport}) — ${c.evidence}`))

  section('⚠️ Possibly stale — in map, no evidence in checked-out repo',
    r.stale.map(s => `- ${s.from} → ${s.to} (\`${s.sdkPackage}\` not in package.json, no queue literal)`))

  section('⏭ Unverifiable — in map, cannot be checked by current extractors',
    r.unverifiable.map(u => `- ${u.from} → ${u.to} — ${u.reason}`))

  section('🔌 Endpoint verification (dataset vs serverless config)',
    r.endpointChecks.map(c => {
      const miss = c.missingInCode.length
        ? ` — missing in code: ${c.missingInCode.slice(0, 4).join(', ')}${c.missingInCode.length > 4 ? '…' : ''}`
        : ''
      const extra = c.extraInCode ? ` — +${c.extraInCode} in code not in map` : ''
      return `- ${c.service}: **${c.verified}/${c.total}** verified (${c.source})${miss}${extra}`
    }))

  section('📨 Async sender evidence (queue literals)',
    r.asyncSenders.map(s => `- ${s.from} → ${s.to} via \`${s.queues.join('`, `')}\` (${s.files.join(', ')})`))

  console.log(`\n## 🌀 AWS event bindings (serverless config: streams, S3, schedules, owned resources)\n`)
  if (!r.awsBindings.length) {
    console.log('_none_')
  } else {
    for (const b of r.awsBindings) {
      console.log(`- **${b.service}**`)
      for (const s of b.streams) {
        const src = s.source === 'self'
          ? 'own stream (internal wiring)'
          : s.source === null
            ? '**source unmapped — needs a mapping decision**'
            : `source: ${s.source}${s.cdcChannelInMap ? ' ✅'
              : s.pairInMap ? ' — **pair mapped under another protocol only, cdc channel missing**'
                : ' — proposed in 🆕 candidates'}`
        console.log(`  - ${s.kind} stream \`${s.stream}\`${s.listeners > 1 ? ` ×${s.listeners}` : ''} — ${src}`)
      }
      for (const t of b.s3Triggers) {
        const src = t.source === 'self'
          ? 'own bucket (internal staging)'
          : t.source === null
            ? '**bucket owner unmapped — needs a mapping decision**'
            : `source: ${t.source}${t.s3ChannelInMap ? ' ✅'
              : t.pairInMap ? ' — **pair mapped under another protocol only, s3 channel missing**'
                : ' — proposed in 🆕 candidates'}`
        console.log(`  - s3 trigger on \`${t.bucket}\`${t.functionName ? ` (${t.functionName})` : ''} — ${src}`)
      }
      for (const sc of b.schedules) {
        console.log(`  - ⏰ ${sc.name} \`${sc.schedule}\`${sc.description ? ` — ${sc.description}` : ''}`)
      }
      for (const o of b.ownedResources) {
        console.log(`  - owns ${o.cfType.replace('AWS::', '')} \`${o.name}\``)
      }
    }
  }

  console.log(`\n## 🏗 Terraform ground truth (sibling *-tf checkouts)\n`)
  if (!r.terraform.length) {
    console.log('_no terraform checkouts found next to the repos_')
  } else {
    const platform = r.terraform.filter(t => !t.inMap)
    console.log(`${r.terraform.length} terraform repos scanned (${platform.length} platform/non-service).\n`)
    for (const t of r.terraform) {
      const bits: string[] = []
      const byType = new Map<string, number>()
      for (const res of t.facts.resources) byType.set(res.tfType, (byType.get(res.tfType) ?? 0) + 1)
      for (const [ty, n] of byType) bits.push(`${ty.replace('aws_', '')}×${n}`)
      if (t.facts.dmsTasks.length) bits.push(`dms-task×${t.facts.dmsTasks.length}`)
      if (t.facts.iamActions.length) bits.push(`iam[${t.facts.iamActions.slice(0, 4).join(',')}${t.facts.iamActions.length > 4 ? ',…' : ''}]`)
      console.log(`- **${t.tfRepo}**${t.inMap ? ` → ${t.service}` : ' _(platform)_'} — ${bits.join(' ') || 'no data resources'}`)
      for (const task of t.facts.dmsTasks) {
        const target = t.facts.dmsEndpoints.find(e => e.endpointType === 'target')
        console.log(`  - DMS ${task.migrationType ?? '?'} task \`${task.taskId ?? task.label}\`${target?.engineName ? ` → ${target.engineName}` : ''}`)
      }
    }
  }

  const usageDrift = r.awsClientUsage.filter(u => u.missingDatabaseEntries.length || u.unevidencedDatabaseEntries.length)
  console.log(`\n## 🔧 AWS client usage in application code (produce/read-write direction)\n`)
  if (!r.awsClientUsage.length) {
    console.log('_none_')
  } else {
    console.log(`${r.awsClientUsage.length} services scanned; ${usageDrift.length} with databases drift:\n`)
    for (const u of r.awsClientUsage) {
      const kinds = u.facts
        .map(f => `${f.kind}[${f.operations.join(',') || 'import-only'}]×${f.fileCount}`)
        .join(' ')
      console.log(`- **${u.service}** — ${kinds}`)
      for (const t of u.missingDatabaseEntries) {
        const files = u.facts.filter(f => f.kind === t)
          .flatMap(f => f.files).slice(0, 2)
        console.log(`  - 🆕 code uses **${t}** but service.databases has no entry (${files.join(', ')})`)
      }
      for (const t of u.unevidencedDatabaseEntries) {
        console.log(`  - ⚠️ databases declares **${t}** but no client code found`)
      }
    }
  }

  if (r.awsLive) {
    const live = r.awsLive
    console.log(`\n## 🛰 AWS live verification (read-only snapshot diff)\n`)
    const matches = live.streamConsumptions.filter(e => e.verdict === 'match')
    console.log(`${live.streamConsumptions.length} cross-service stream consumptions (${matches.length} match the map):`)
    for (const e of live.streamConsumptions) {
      const mark = e.verdict === 'match' ? '✅' : e.verdict === 'new' ? '🆕' : `⚠ pair in map as [${e.mapProtocols.join(',')}]`
      console.log(`- ${mark} ${e.consumer} → ${e.source} _(${e.via}, ${e.state})_`)
    }
    if (live.mapEdgesWithoutLiveBinding.length) {
      console.log(`\nMap cdc/kinesis edges with no live binding (informational — absence in this account is weak evidence):`)
      for (const e of live.mapEdgesWithoutLiveBinding) console.log(`- ⏭ ${e.from} → ${e.to} (${e.protocol})`)
    }
    if (live.orphanQueues.length) {
      console.log(`\nService-prefixed queues with NO consumer binding (orphan candidates):`)
      for (const q of live.orphanQueues) console.log(`- ❓ ${q}`)
    }
    if (live.bucketCouplings.length) {
      console.log(`\nBucket-notification couplings:`)
      for (const b of live.bucketCouplings) console.log(`- ${b.bucket} → ${b.targets.join(' | ')}`)
    }
    if (live.dmsTasks.length) {
      console.log(`\nDMS replication tasks:`)
      for (const t of live.dmsTasks) console.log(`- ${t.status.padEnd(8)} ${t.id} [${t.type}]`)
    }
    if (live.scheduledRules.length) {
      console.log(`\nScheduled rules:`)
      for (const s of live.scheduledRules) {
        console.log(`- ${s.known ? '✅' : '🆕'} [${s.state}] ${s.rule} \`${s.schedule}\`${s.service ? ` (${s.service})` : ''}`)
      }
    }
    if (live.unresolvedPrefixes.length) {
      console.log(`\nUnresolved function prefixes (noise/POCs/unmodeled): ${live.unresolvedPrefixes.join(', ')}`)
    }
  }

  const datadog = datadogSection(r.datadog)
  if (datadog) {
    console.log(datadog)
  }

  section('🖥 Frontend service usage',
    r.frontendServices.map(f => `- svc host \`${f.service}\` ${f.inMap ? '(in map)' : '**(not in map)**'} — ${f.evidence}`))

  if (r.monolithSurface) {
    console.log(`\n## 📥 Monolith inbound surface (informational)\n`)
    console.log(`${r.monolithSurface.totalRoutes} routes resolved to controller#action, ${r.monolithSurface.unparsed.length} lines unparsed. Top segments:`)
    console.log(r.monolithSurface.topSegments.map(([seg, n]) => `- /${seg} (${n})`).join('\n'))
    if (r.monolithSurface.unparsed.length) {
      console.log(`\nUnparsed:\n${r.monolithSurface.unparsed.map(l => `- \`${l}\``).join('\n')}`)
    }
  }

  section('🩻 Weak SDK evidence — type-only or unused imports (likely NOT runtime calls)',
    r.weakSdkEvidence.map(w => `- ${w.from} → ${w.to} via \`${w.pkg}\` (**${w.usage}**)`))

  if (r.sdkRegistryStats) {
    console.log(`\n## 🧩 SDK call-site verification (registry: ${r.sdkRegistryStats.packages} packages, ${r.sdkRegistryStats.methods} methods)\n`)
    const interesting = r.sdkUsage.filter(f => f.suggestedAdditions.length || f.unproven.length)
    console.log(`${r.sdkUsage.length} SDK connections with call-site evidence; ${interesting.length} with usedEndpoints drift:`)
    for (const f of interesting) {
      console.log(`- **${f.from} → ${f.to}**`)
      for (const c of f.calledMethods.filter(c => c.endpointId && f.suggestedAdditions.includes(c.endpointId))) {
        console.log(`  + suggest \`${c.endpointId}\` — .${c.method}() → ${c.httpMethod} ${c.path} (${c.files.join(', ')})`)
      }
      for (const a of f.ambiguousCalls) {
        console.log(`  ~ ambiguous .${a.method}() — one of [${a.candidateIds.join(', ')}] (${a.files.join(', ')})`)
      }
      for (const id of f.unproven) console.log(`  ? unproven \`${id}\` (no call site, not even ambiguous)`)
      for (const c of f.calledMethods.filter(c => !c.endpointId)) {
        console.log(`  ! unmatched call .${c.method}() → ${c.httpMethod} ${c.path} (no endpoint on ${f.to})`)
      }
    }
  }

  console.log(`\n## 🧭 Flow verification (${r.flowCheck.findings.length} findings)\n`)
  console.log(`${r.flowCheck.stepsChecked} service steps checked (${r.flowCheck.responseSteps} response arrows), ${r.flowCheck.pathsChecked} action paths checked.`)
  if (r.flowCheck.findings.length) {
    console.log(r.flowCheck.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
  } else {
    console.log('_all flows consistent with connections and endpoints_')
  }

  const cl = r.codeLayerCheck
  console.log(`\n## 🫀 Flow code layers (${cl.findings.length} findings)\n`)
  if (cl.flowsWithCodeLayer === 0) {
    console.log('_no flow declares a code layer yet_')
  } else {
    console.log(`${cl.flowsWithCodeLayer} flow(s) with a code layer — ${cl.pathsVerified} unit paths verified on disk.`
      + (cl.skippedRepos.length ? ` Skipped (repo not checked out): ${cl.skippedRepos.join(', ')}.` : ''))
    if (cl.findings.length) {
      console.log(cl.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every code unit path exists_')
    }
  }
  const cg = r.codeGrades
  if (!cg) {
    console.log('\n🫀 grades require --pinned (graphs are only trusted at the pinned commit)')
  } else {
    const d = cg.distribution
    console.log(`\n### Call-edge grades (${cg.findings.length} findings)\n`)
    console.log('| graph | constant | import | text | none |\n|---|---|---|---|---|')
    console.log(`| ${d.graph} | ${d.constant} | ${d.import} | ${d.text} | ${d.none} |`)
    if (cg.findings.length) {
      console.log(`\n${cg.findings.map(f => `- [${f.kind}] **${f.flow || f.subject}**: ${f.kind === 'ungraded-edge' ? `${f.subject} — ${f.detail}` : f.detail}`).join('\n')}`)
    }
    if (cg.backlog.length) {
      console.log(`\nText-only evidence (review backlog, ${cg.backlog.length}):\n${cg.backlog.map(b => `- ${b}`).join('\n')}`)
    }
  }

  const bc = r.branchCheck
  console.log(`\n## 🔀 Flow branches (${bc.findings.length} findings)\n`)
  console.log(`${bc.verified} branch literal(s) verified in comment-stripped unit sources.`
    + (bc.skippedRepos.length ? ` Skipped (repo not checked out): ${bc.skippedRepos.join(', ')}.` : ''))
  if (bc.findings.length) {
    console.log(bc.findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`).join('\n'))
  }
  console.log(machineSection(r.machineCheck))
  if (r.listenerCheck) {
    console.log(listenerSection(r.listenerCheck))
  }

  const rs = r.resourceCheck
  if (rs) {
    console.log(`\n## 🗄 Resources (${rs.findings.length} findings)\n`)
    console.log(`${rs.total} resources — ${Object.entries(rs.byKind).map(([k, n]) => `${n} ${k}`).join(' · ')}.`)
    console.log(`Model-less tables: ${rs.modelLess.length ? rs.modelLess.join(', ') : '_none_'}`)
    const relCounts: Record<string, number> = {}
    for (const rel of r.liveRelations) {
      relCounts[`${rel.relation} (${rel.grade})`] = (relCounts[`${rel.relation} (${rel.grade})`] ?? 0) + 1
    }
    console.log(`Relations: ${Object.entries(relCounts).map(([k, n]) => `${n} ${k}`).join(' · ') || '_none_'}`)
    if (rs.findings.length) {
      console.log(rs.findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`).join('\n'))
    }
  }

  const rc = r.ruleCheck
  console.log(`\n## 📐 Domain rules (${rc.findings.length} findings)\n`)
  if (rc.rulesChecked === 0) {
    console.log('_no domain rules declared yet_')
  } else {
    console.log(`${rc.rulesChecked} rule(s) — ${rc.pathsVerified} source paths verified on disk, ${rc.hashesVerified} staleness stamps matched.`
      + (rc.skippedRepos.length ? ` Skipped (repo not checked out): ${rc.skippedRepos.join(', ')}.` : ''))
    if (rc.findings.length) {
      console.log(rc.findings.map(f => `- [${f.kind}] **${f.rule}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every rule source path exists_')
    }
  }

  const ar = r.areaCheck
  console.log(`\n## 🗺 Product areas (${ar.findings.length} findings)\n`)
  console.log('| host repo | mapped | total | coverage |')
  console.log('|---|---|---|---|')
  for (const [repo, c] of Object.entries(ar.coverage)) {
    console.log(`| ${repo} | ${c.mapped} | ${c.total} | ${c.total ? Math.round((c.mapped / c.total) * 100) : 0}% |`)
  }
  console.log(`\n${ar.anchorsVerified} glossary anchors verified, ${ar.evidenceVerified} external evidence literals found, ${ar.overlaps.length} files shared by two product areas.`
    + (ar.skippedRepos.length ? ` Skipped (repo not checked out): ${ar.skippedRepos.join(', ')}.` : ''))
  if (ar.findings.length) {
    console.log(ar.findings.map(f => `- [${f.kind}] **${f.subject}**: ${f.detail}`).join('\n'))
  }
  for (const [repo, c] of Object.entries(ar.coverage)) {
    if (c.unmappedByDir.length) {
      console.log(`\n**Unmapped in ${repo}** (top 15 directories — the adoption backlog):`)
      console.log(c.unmappedByDir.slice(0, 15).map(d => `- \`${d.dir}\` — ${d.files} files`).join('\n'))
    }
  }
  if (ar.overlaps.length) {
    console.log(`\n**Shared files** (first 20):`)
    console.log(ar.overlaps.slice(0, 20).map(o => `- ${o.repo}:\`${o.file}\` — ${o.areas.join(', ')}`).join('\n'))
  }

  const flc = r.failureCheck
  console.log(`\n## 🧯 Failure layer — async edges into services (${flc.findings.length} findings)\n`)
  if (flc.inScopeEdges === 0) {
    console.log('_no in-scope async edges (unit → svc-*)_')
  } else {
    console.log(`${flc.inScopeEdges} in-scope edge(s) — ${flc.verifiedDlqs} DLQ fact(s) verified against config, ${flc.waivers} confirmed-missing waiver(s).`
      + (flc.skippedServices.length ? ` Skipped (no facts extracted): ${flc.skippedServices.join(', ')}.` : ''))
    if (flc.findings.length) {
      console.log(flc.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every in-scope async edge carries a verified DLQ fact or an explicit waiver_')
    }
  }

  const ac = r.authCheck
  console.log(`\n## 🔐 Auth context (${ac.findings.length} findings)\n`)
  if (ac.gatesChecked === 0 && ac.authorizersChecked === 0) {
    console.log('_no typed auth refs yet_')
  } else {
    console.log(`${ac.gatesVerified}/${ac.gatesChecked} permission gate(s) verified in source, ${ac.authorizersVerified}/${ac.authorizersChecked} authorizer(s) verified against config.`
      + (ac.skippedRepos.length ? ` Skipped (repo/facts unavailable): ${ac.skippedRepos.join(', ')}.` : ''))
    if (ac.findings.length) {
      console.log(ac.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every gate appears in source and every authorizer is declared in config_')
    }
  }

  const cc = r.contractCheck
  console.log(`\n## 📜 Contract refs — edges vs generated TSOA specs (${cc.findings.length} findings)\n`)
  if (cc.refsChecked === 0 && !cc.skippedServices.length) {
    console.log('_no contract refs yet_')
  } else {
    console.log(`${cc.refsVerified}/${cc.refsChecked} refs verified against checked-in specs.`
      + (cc.skippedServices.length ? ` Skipped (no tmp/swagger.json): ${cc.skippedServices.join(', ')}.` : ''))
    if (cc.findings.length) {
      console.log(cc.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else if (cc.refsChecked > 0) {
      console.log('_every contract ref exists in its target\'s generated spec_')
    }
  }

  const pf = r.piiFacts
  const pc = r.piiCheck
  console.log(`\n## 🧬 PII surface — decorator-first, heuristic as review-assist (${pc.findings.length} findings)\n`)
  if (!pf) {
    console.log('_skello-libs-ts not checked out — PII scan skipped_')
  } else {
    console.log(`${pf.piiTyped.length} decorator-typed PII field(s) across ${pf.decoratedPackages.join(', ')} — ${pf.explicitNonPii} fields explicitly non-PII (@NoAnonymizer). `
      + `${pc.refsVerified}/${pc.refsChecked} edge PII ref(s) verified.`
      + (pc.skippedServices.length ? ` Skipped (no decorator-covered SDK): ${pc.skippedServices.join(', ')}.` : ''))
    if (pc.findings.length) {
      console.log(pc.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    }
    if (pf.candidates.length) {
      const byPkg = new Map<string, number>()
      pf.candidates.forEach(c => byPkg.set(c.pkg, (byPkg.get(c.pkg) ?? 0) + 1))
      console.log(`\nReview-assist — ${pf.candidates.length} name-heuristic candidate field(s) in packages WITHOUT decorator coverage `
        + `(${[...byPkg.entries()].map(([p, n]) => `${p}: ${n}`).join(', ')}). `
        + 'Candidates are NOT facts — they are the adoption backlog for lib-anonymizer decorators.')
      console.log(pf.candidates.slice(0, 12).map(c => `- ${c.file} · \`${c.field}\``).join('\n')
        + (pf.candidates.length > 12 ? `\n- … ${pf.candidates.length - 12} more` : ''))
    }
  }

  const fc = r.flagCheck
  console.log(`\n## 🚩 Feature-flag refs (${fc.findings.length} findings)\n`)
  if (fc.distinctFlags === 0) {
    console.log('_no typed flag refs yet_')
  } else {
    console.log(`${fc.distinctFlags} distinct flag(s) — ${fc.refsVerified}/${fc.refsChecked} refs verified in source.`
      + (fc.skippedRepos.length ? ` Skipped (repo not checked out): ${fc.skippedRepos.join(', ')}.` : ''))
    if (fc.findings.length) {
      console.log(fc.findings.map(f => `- [${f.kind}] **${f.flow}**: ${f.detail}`).join('\n'))
    } else {
      console.log('_every flag ref appears literally in its unit\'s source_')
    }
  }

  section('❓ Unknown targets — evidence pointing outside the map',
    r.unknownTargets.map(u => `- ${u.from} → \`${u.evidence}\` (resolves to "${u.normalizedTarget}")`))

  section('📦 Repos without a service definition (add to the map?)',
    r.reposWithoutServiceDefinition.map(x =>
      `- ${x.repo}${x.httpEndpoints ? ` — ${x.httpEndpoints} HTTP endpoints` : ''}${x.queues ? `, ${x.queues} queues` : ''}`))

  section('🗺 Rails clients needing a mapping decision',
    r.railsUnmapped.map(f => `- ${f}`))

  section('👥 Product-team slugs not mapped in teams.ts (structural squads excluded)',
    r.unmappedGithubTeams.map(t => `- ${t}`))

  section('📚 Ignored shared libraries',
    Object.entries(r.ignoredSdks).map(([pkg, repos]) =>
      `- \`${pkg}\` — ${IGNORED_SDKS[pkg]} (${repos.length} repos)`))

  const epVerified = Object.keys(r.endpointStamps).length
  const epTotal = r.endpointChecks.reduce((n, c) => n + c.total, 0)
  const keys = findingKeys({ ...r })
  const delta = diffBaseline(keys, readBaseline(BASELINE_PATH))
  console.log(`\n## 🧾 Baseline — ${delta.added.length} new · ${delta.resolved.length} resolved · ${delta.carried} carried\n`)
  if (unscanned.length) {
    console.log(`⚠ Not scanned this run: ${unscanned.join(', ')} — their baseline findings are unverified, not resolved.\n`)
  }
  if (delta.added.length) {
    console.log(`New:\n${delta.added.map(k => `- ${k}`).join('\n')}`)
  }
  if (delta.resolved.length) {
    console.log(`\nResolved:\n${delta.resolved.map(k => `- ${k}`).join('\n')}`)
  }

  console.log(`\n## Summary\n`)
  console.log(`| connections verified | endpoint stamps | candidates | stale | unverifiable | unknown targets |`)
  console.log(`|---|---|---|---|---|---|`)
  console.log(`| ${verified.length} | ${epVerified}/${epTotal} | ${r.candidates.length} | ${r.stale.length} | ${r.unverifiable.length} | ${r.unknownTargets.length} |`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const dataset: Dataset = {
  map: connectivityMap,
  resources: resourceSurface,
  committedListeners: fs.existsSync(LISTENERS_PATH) ? ListenerSurfaceSchema.parse(JSON.parse(fs.readFileSync(LISTENERS_PATH, 'utf-8'))) : null,
}
const options: DiscoveryOptions = {
  sourceBase: SOURCE_BASE,
  dataset,
  pinnedBase: PINNED_MODE ? PINNED_BASE : undefined,
  fetchOrigin: !process.argv.includes('--no-fetch'),
  now: NOW,
  awsSnapshotDir: AWS_SNAPSHOT_DIR ?? undefined,
  datadogSnapshotDir: DATADOG_SNAPSHOT_DIR ?? undefined,
}

function discover(): Report {
  try {
    return runDiscovery(options)
  } catch (e) {
    if (e instanceof PinError) {
      console.error(e.message)
      process.exit(2)
    }
    throw e
  }
}

const report = discover()
const pinnedRepos = report.pinned?.repos
const unscanned = pinnedRepos ? unscannedRepos(readBaselineRepos(BASELINE_PATH), pinnedRepos.map(p => p.repo)) : []
if (JSON_MODE) {
  console.log(JSON.stringify(report, (_key, value: unknown) => (value instanceof Map ? Object.fromEntries(value) : value), 2))
} else {
  printMarkdown(report, unscanned)
}
if (APPLY_MODE) {
  writeOutputs(report, { outDir: OUT_DIR, repoBase: REPO_BASE, now: NOW })
}
if (BASELINE_MODE) {
  writeBaseline(BASELINE_PATH, findingKeys({ ...report }), pinnedRepos ? pinnedRepos.map(p => p.repo) : report.scannedRepos)
  console.log(`\nBaseline written: ${path.relative(process.cwd(), BASELINE_PATH)}`)
}
if (FAIL_ON_NEW && (diffBaseline(findingKeys({ ...report }), readBaseline(BASELINE_PATH)).added.length || unscanned.length)) {
  process.exitCode = 1
}
