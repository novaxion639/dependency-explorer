# Grounding — Flow Expressiveness evaluation

Code findings from the seven capability-cluster grounding agents (2026-07-19), run against
dependency-explorer + svc-punch, svc-requests, svc-employees, skello-app, skello-mobile,
skello-punchclock, skello-libs-ts. Facts here feed `roadmap.md` and `spec-challenge.md`.

## A · Failure & resilience

**Reuse:** `FlowCodeEdge.mode` (`sync|async-job|async-event`) already discriminates async edges — no new enum. `packages/discovery/src/extractors/serverless.ts` (`parseServerlessState`/`parseServerlessStatic`) is the extension point; `flow-check.ts` + the 🫀 section (`discover.ts:773`) is the checker/report template; `queue-senders.ts` is the queue-name cross-referencing precedent.

**New:** DLQ/retry parsing does not exist — the static stream-block parser *explicitly stops at `destinations:`* (`serverless.ts:282`), discarding the exact literal needed. Three parse shapes required: raw CloudFormation `RedrivePolicy` blocks; `createSqs({dlqToAppend})` call-site arguments (the factory materializes RedrivePolicy once — per-queue wiring is an argument, not a literal); `onFailure` destinations whose ARN is a `Fn::GetAtt` object, not a string. Edge→queue linkage is new plumbing (authored `failure.dlq` name, checker matches it against extracted facts).

**Surprises:** the checker's true applicability domain is **~16 of 66 async edges** (the rest are intra-monolith Sidekiq or infra-node hops). svc-punch/svc-requests — the extraction-evidence services — are not async-edge *targets* anywhere in the dataset; first backfill lands on svc-events (3), svc-websockets (2), svc-intelligence (1); svc-search's 7 are CDC/DMS (different fault model, excluded). Ready-made `confirmed-missing` fixtures: svc-requests' leave-request notification/mail queues are created *without* `dlqToAppend` even though same-named `*Dlq` queues sit beside them — name pairing proves nothing, only actual RedrivePolicy wiring counts.

## B · Feature-flag registry

**Reuse:** the flag checker is a ~25-line parametrization of the existing `unreferenced-callee` loop in `flow-check.ts:117-143` (`readUnitFile` + `content.includes(flagName)`), not a new engine. `condition` already carries `"FF: FEATUREDEV_…"` prose in 3 flows (+1 untagged mention); `flags?` is additive next to it. The registry (flag→flows) is a build-time fold over the in-memory dataset — no extractor.

**Surprises:** `kind` is **not** derivable from the name — `can_access?('ACCESS_LEGAL_WEEKLY_HOURS')`, `can_access?('MISSIONS_DEFAULT_SETTING_ON')` are product flags without a prefix; ~10.5% of `can_access?` call sites break the prefix heuristic. Kind comes from the wrapping helper method at the call site → authored in the dataset, checker-assisted. Usage skew: `dev_flag_activated?` 165 call sites vs `can_access?` 38 — dev flags dominate 4:1. Backfill is small: 6 flow files carry flag literals (5 named flags).

## C · Domain-rule cards

**Reuse:** `teams.ts`/`domains.ts` are the registry precedent (flat `Schema.array().parse([...])` wired into `connectivityMap`); `integrity.test.ts` is the referential/orphan harness; `flow-check.ts` already does `fs.existsSync` on unit paths under `pnpm discover` — the checker-split doctrine is the *established* architecture, not a new invention. `ProvenanceSchema.lastVerified` is the stamp vocabulary to keep.

**New:** no `rules.ts`, no `DomainRuleSchema`, and **no hashing utility anywhere in packages/** (`contentHash|sha256|createHash|checksum` → zero hits) — the staleness stamp is genuinely new code (`node:crypto` next to flow-check).

**Surprises:** the `web|mobile|tablet` platform enum mismatches the flagship — mobile is a **non-participant** in overnight day-attribution (phone posts a punch; svc-punch + monolith do the bucketing). The real shape: a backend **source of truth** (svc-punch `calculateOutAuto`), the monolith engine, a web-front *client-side reimplementation* ("Client-side mirror of the backend day attribution" — a drift risk, not a divergence), and the tablet's offline-only open-badging guard. Schema needs a `sourceOfTruth` ref and/or a `backend|monolith` platform value. The editorial lift is real: the rule is threaded through 3 flow descriptions + 5+ codeUnit descriptions — no single paragraph to cut-and-paste.

## D · Auth & permission context

**Reuse:** `AuthTypeSchema` enum reusable for the token-type half (new optional edge-level wrapper — the existing field is required + connection-level). `extractServerless()` already walks `serverless/**/*.ts` — svc-punch's split lambda files are covered without new plumbing; authorizer capture is one more field from a block the parser already opens. Rails greppability confirmed exactly (357 `before_action`; 685 `can_*!/?` under app/).

**Surprises:** the plan's path claim was backwards — **`app/controllers/v3/api/` exists**: 140 files, 249 `before_action`, 531 authorize/can_* hits (app/services/v3 is the thin one). Two authorizer syntaxes in the wild: bare string per function (svc-employees) vs object form in split resource files (svc-punch). Coverage is genuinely partial — 21 svc-punch httpApi routes carry **no** `authorizer:` at all vs 15 explicit declarations → the schema needs an `authAbsent`-style signal, parallel to `dlqAbsent`. Authorizer *names* (`…JwtOrApiKey`, `…AllManagedUsers`) mix token type and permission tier — confirming the two-fact split; the permission-gate half starts as free text. One boundary case has no home in {token, gate}: token-*lifecycle* facts ("stale tablet token deliberately reusable offline") stay prose.

## E · Doc integrity

**Reuse:** `discover.ts` APPLY_MODE write pattern; `scaffold.ts` codegen doctrine; `FlowListModal.getFlowDomains()` (to extract into a shared util instead of a third reimplementation); `integrity.test.ts` as the self-contained CI-gate pattern.

**Surprises:** the plan's "same pattern as the discovered overlay" gate **does not exist** — CI runs only typecheck/test/build; `pnpm discover` never runs there. Neither doc is referenced by any code. `planning-actions-coverage.md` is essentially **not derivable**: its organizing unit (sub-flow UI actions) has zero schema representation, and a dataset recording only what exists cannot derive the ❌ rows. The generator owns marked sections (flow counts/lists, per-domain attribution, zero-flow-domain flags); analysis prose stays hand-authored.

## F · Flow composition links (new axis)

**Evidence:** 13 cross-flow prose references exist today (header comments + description strings), never structured. `leave-request-approval` is the flagship: its CDC→SNS→`CreateShiftsJobHandler` write-back POSTs `/private/shifts` — the *same domain action as* shift-creation but through a **different, unmodeled entry point**. The svc-punch fan-out's source side is confirmed (own Dynamo stream → Firehose/SNS/SQS handlers); the KPI/salary-mass destination side is **unverified** (svc-kpis/svc-events outside the grounding scope) — treat as illustrative.

**Design consequence:** prose refs encode **three distinct relationships** — same-journey-split-by-platform (employee-clock-in ↔ mobile-clock-in), literal continuation (badging-review), and domain-write-back via a different entry point (leave-request-approval). A flat `triggers: string[]` collapses them — the link needs a `kind` (`continuation | writes-back-to | same-journey | domain-related`). Only one direction authored; the reverse is derived at build time. No extractor is buyable here — links are human-authored, checker-verified for id-existence only.

## G · PII + reverse index (new axes)

**PII:** name-heuristic precision looked clean in samples but density is package-dependent and *inverted vs. stakes* — payroll/HRIS SDKs (highest-stakes) have the LOWEST field-name hit density (1/43, 2/34) because their DTOs are sync bookkeeping; the person-level PII lives in provider payloads/monolith. A stronger source exists that the plan never mentioned: **`@skelloapp/lib-anonymizer` decorators** (`@RandomAnonymizer(EMAIL|FIRST_NAME|…)`, `@NoAnonymizer`, `@DeleteAnonymizer`) — explicit machine-readable per-field PII typing, today only on 5 svc-punch-sdk models. Verdict: decorator-scan-first + name-heuristic as review-assist; **not committable as an authoritative axis yet**.

**Reverse index:** pure derived fold over `connectivityMap.flows[].codeUnits[].path` — 237/239 units carry paths; the whole dataset is already client-resident (`buildSearchIndex(map)` runs over it at load). Two tiers: (a) ~1 line — append `unit.path` to the flow entries' ⌘K haystack; (b) a real `file` entity type, which needs a landing view that doesn't exist yet (the one open UI design question).

## Cross-cutting tooling note

Plain `grep` with multi-file expansion is intercepted by the rtk hook in this environment and can silently return zero matches — agents route through `rtk proxy grep` (or Python) for multi-file sweeps. Two grounding agents independently hit this.
