# Plan: Flow-detail improvement axes → docs/spec.md + docs/features.md

## Context

The dependency-explorer's 39 flows all carry verified code layers, but the audit shows every
schema field is already used AND rendered — so making flows more precise for developers means
new *expressiveness* dimensions, not better use of existing ones. Absent today: error/failure
paths, retries/DLQs, idempotency, flow-level auth context, typed feature-flag refs,
payload/event contracts, test links, observability, timing; guards are free text; domain rules
(overnight day-attribution — the punch-bug hotspot) and web-vs-mobile divergences rot in prose.
Docs have drifted: the authoring guide's schema reference omits the entire code layer;
flow-inventory.md and planning-actions-coverage.md are stale at the 23-flow mark.

Ben wants improvement axes proposed via the repo's project-management skills: **spec-generator**
(product spec.md) → **feature-generator** (dependency-ordered features.md). Extractability of
each axis was verified in the sibling repos (evidence below), honoring "automation owns facts."
Ben decided: files live in **`dependency-explorer/docs/`**; P1 = the designed four axes **plus
auth/permission context promoted** (five total).

## Deliverables

1. `docs/spec.md` — product spec "Flow Expressiveness" following the spec-generator template
   (Context / Overview / Goals / User Roles / Core Features / Technical Stack; cut axes go in
   Overview's "what it is NOT" — the template forbids an Out-of-Scope section).
2. `docs/features.md` — feature-generator expansion: ~17 features in 5 dependency tiers, each
   PR-sized and independently `pnpm check`-green.
3. Feature branch + PR to master (repo convention; Ben merges).

## Spec content — the five P1 axes

Each Core Feature section uses four sub-headings: *Schema* / *Verification* / *UI* / *Backfill*.

**A. Failure & resilience layer.** Optional `failure` object on async `FlowCodeEdge`s:
`{ dlq?, retryPolicy?, idempotent?, onError? }` (`onError` human-owned narrative, rest facts).
Extractor: extend the serverless-config extractor — DLQ/redrive/retry literals verified present
(`svc-punch/serverless.ts` redrivePolicy + maxReceiveCount:3, per-fn onFailure +
maximumRetryAttempts 3/5/10; svc-requests indirects via `SqsHelper.ts`, default 3). New 🧯 drift
section: every async edge into a svc-* must carry a dlq matching serverless config — missing DLQ
is also a Lambda-standard violation, so the checker doubles as an org compliance audit (lead
with this in Context). UI: shield/warning badge on async edges.

**B. Typed feature-flag registry.** `FeatureFlagRefSchema { name, kind: product|dev, scope? }`;
`flags?` on code units/edges; `condition` stays for non-flag guards. Registry (flag → flows)
derived at build time, never authored. Checker: 🫀-style — flag name must appear literally in
the caller unit's source (verified greppable: 189 FEATUREDEV_ hits in skello-app/app, ~350 in
skello-mobile/src; prefixes carry canary/platform semantics). NO rollout state (runtime data —
Phase 4 overlay). UI: flag chips + ⌘K flag entity ("which flows touch FEATUREDEV_X").

**C. Domain-rule cards + divergence records (merged axis).** `DomainRuleSchema { id, title,
statement, divergences?: [{ platform: web|mobile|tablet, behavior, codeUnitRef? }],
sourcePaths[] }` in a new `packages/data/src/rules.ts`; `ruleRefs?` on steps/code units.
Statement is human-owned meaning; checker verifies refs resolve, sourcePaths exist, no orphan
rules. Flagship payload: overnight day-attribution + clock-in/shift coupling lifted from the
punch flows' prose, with the web/mobile/tablet divergence table. UI: rule badge → rule card
with platform-column table; rules in ⌘K.

**D. Auth & permission context (promoted by Ben).** Flow-level `trigger` (actor/role) +
per-edge auth ref (token type, permission gate). Extraction verified: Rails 357 `before_action`
+ 313 Pundit `can_*!/?` predicates with greppable `authorize` call sites (note: NO
`app/controllers/api/v3` dir — v3 lives under `app/services/v3/`); svc-* declare per-route
named `authorizer:` in serverless (`SkelloLambdaAuthorizerJwtOrApiKey` etc. — fully
machine-readable). The punch three-tier auth chain becomes typed instead of prose. Rails-side
extraction is noisier — spec marks the monolith half as human-authored + checker-verified
(gate name must appear in the controller source), svc-* side extractor-owned.

**E. Doc integrity — generated, not refreshed.** Generator script (packages/discovery, next to
flow-check.ts) renders flow-inventory.md + planning-actions-coverage.md from the dataset;
`pnpm check` fails on diff (same pattern as the discovered overlay). Hand-write the
authoring-guide code-layer chapter LAST so it documents the final field set (incl. A–D).

**P2 (named in spec as "Later"):** contract references (Swagger operationId refs verified
against TSOA output — `svc-punch/tmp/swagger.json` checked in, dual public/internal specs;
weak on the monolith), coverage expansion (remaining flows: contract-amendment,
employee-archival, assistant-freemium-credits, pos-revenue-ingestion, document-share,
org-onboarding, mission-management, third-party-webhook, staff-register-export + ~17 planning
action gaps — deliberately AFTER the schema so new flows are authored once).

**Cut (Overview "what it is NOT"):** timing/SLA view (statically unverifiable — would be the
dataset's first unverifiable-claim class; `phase` at 2/39 shows low ordering demand),
observability links (Phase 4 read-only overlay by roadmap; alarms live in `*-tf` repos),
test-coverage mapping (mirror-path convention confirmed but serves CI dashboards, not the map),
flag rollout state (runtime, changes without a commit).

## features.md tiers (dependency-ordered)

- **T1 Schema (4):** F1 failure fields; F2 flag refs; F3 rule schema + registry; F4 auth/trigger
  fields — each = Zod change + type exports + integrity-test extension only.
- **T2 Extractors & checkers (4):** F5 serverless DLQ/retry extraction + 🧯 section; F6 flag
  checker + build-time aggregation; F7 rule referential/orphan/path checker; F8 svc-* authorizer
  extractor + auth-gate source checker. Checkers land BEFORE backfill (red-to-green workflow).
- **T3 UI (4):** F9 failure badges; F10 flag chips + ⌘K; F11 rule cards + badges + ⌘K; F12 auth
  context in flow modal (shared annotation-chip component if F9–F12 would triplicate it).
- **T4 Backfill (4):** F13 failure metadata on async edges (sized by checker report); F14 migrate
  flag mentions out of `condition`; F15 punch-domain rule cards + divergence records; F16 auth
  context on the 39 flows (punch three-tier chain first).
- **T5 Docs (2):** F17 generated inventory/coverage docs + check gate; F18 authoring-guide
  code-layer chapter (last — documents final field set).

## Execution steps (this session)

1. `git checkout master && git pull`, branch `phase-3/flow-expressiveness-spec`.
2. Invoke **spec-generator** skill; author `docs/spec.md` per its template + the content above
   (adapt output path from the skill's /mnt/... default to the repo). Writing style: definitive,
   no progression language (global CLAUDE.md rule).
3. Invoke **feature-generator** skill on that spec; author `docs/features.md` (numbered features,
   user flow + UI overview each, dependency order = tiers above).
4. Cross-check the pair for sync (every spec Core Feature covered; no feature without a spec
   anchor); flow-authoring-guide/README untouched (they change when implementation lands).
5. Commit (conventional), push with `-u origin <branch>` (verify upstream), open PR to master,
   wait CI in background; Ben merges.
6. Update memory (project note: expressiveness spec proposed, five P1 axes) and, if Ben wants,
   the status artifact later.

## Verification

- `pnpm check` still green (docs-only change — run anyway before pushing).
- Every factual claim in spec.md traces to the verified evidence above (no unverified
  extractability assertions).
- features.md ordering respects: T2→T1, T4→T2, F18 last.
- CI green on the PR.

## Key files

- New: `docs/spec.md`, `docs/features.md` (dependency-explorer repo).
- Referenced (unchanged this session): `packages/schema/src/index.ts` (FlowCodeEdgeSchema ~L163,
  FlowCodeUnitSchema ~L151), `packages/discovery/src/flow-check.ts` (🫀 pattern),
  `packages/discovery/src/extractors/serverless*.ts`, `packages/web/src/utils/buildFlowCodeGraph.ts`,
  `packages/web/src/components/connectivity/FlowGraphModal.tsx`, `docs/flow-authoring-guide.md`.
