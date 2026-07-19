# Flow Expressiveness — Specification

> **Context:** The 39 business flows all carry machine-verified code layers, and every schema
> field is both used and rendered — deeper developer comprehension therefore requires new
> expressiveness dimensions, not better use of existing ones. This spec is the product of an
> adversarial evaluation of the original five-axis plan (`docs/improvements/` — challenge
> report, grounding, MVP cut): six blockers were resolved by amendment, two axes were added by
> the missing-axes panel, and every extraction claim below is grounded with file-level evidence.

## Overview

Flow Expressiveness is a release of the dependency-explorer that gives each business flow
seven new machine-checked detail dimensions: domain-rule cards with staleness watching,
a typed feature-flag registry, failure/DLQ metadata on async edges, auth and permission
context, flow-to-flow composition links, generated inventory docs, and a reverse
code→flows index. Its users are Skello developers reading the map during development and
incidents, the flow authors who maintain the dataset, and the discovery scanner that owns
every extractable fact. It is NOT: a timing/SLA view (statically unverifiable — it would
create the dataset's first unverifiable-claim class), an observability overlay (Phase 4
renders live data read-only at view time), a test-coverage dashboard (a CI concern, not a
map concern), a flag rollout-state tracker (runtime data that changes without a commit), or
an authoritative PII auto-tagger — the PII surface ships decorator-first (feature 9): only
`@skelloapp/lib-anonymizer`-typed fields become facts, and the name-heuristic sweep is a
review-assist backlog, never authored data (its hit density is lowest in the highest-stakes
SDKs).

Two invariants govern every dimension. **Every new schema field is optional** — schema
changes land with zero dataset migration and `pnpm check` stays green at each step. **The
checker split is absolute** — source-verifying checks (DLQ wiring, flag literals, rule
source paths, auth gates) run in the `pnpm discover` CLI report with sibling repos on disk,
exactly where the 🫀 code-layer checker runs today; CI gates only self-contained integrity.

---

## Goals

- The punch-domain rules (overnight day-attribution, clock-in/shift coupling) exist as
  structured rule cards whose source files are hash-watched — narrative drift is flagged by
  the discovery report the day upstream code changes.
- Zero feature flags remain as free text: the 6 flag-carrying flows use typed refs, and any
  flag can be found from ⌘K with the flows it gates.
- Every async service edge in scope (~16 of 66 async edges) carries DLQ/retry facts or an
  explicit `confirmed-missing` waiver, and the 🧯 report doubles as an org DLQ-standard audit.
- All 39 flows state who can trigger them; the punch three-tier auth chain is typed data.
- The 13 prose cross-flow references are typed, kind-qualified, navigable links.
- `docs/flow-inventory.md` and `docs/planning-actions-coverage.md` carry generated sections
  gated by `pnpm check` — the "23 flows" staleness class is structurally impossible.
- The authoring guide documents 100% of schema fields, including the code layer.

---

## User Roles

### Developer (reader)
- Opens flows in the SPA during feature work or incidents; reads rule cards, flag chips,
  DLQ shields, auth context; ⌘K-searches flags, rules, and source-file paths.
- Writes nothing; needs no setup beyond `pnpm dev`.

### Flow author (contributor)
- Authors rules, flag refs, failure metadata, triggers, and links in `packages/data`,
  following the authoring guide; runs `pnpm discover` locally to verify source-backed claims.
- Cannot merge red: `pnpm check` gates every PR on self-contained integrity.

### Architect / lead
- Reads the 🧯 DLQ audit and auth-coverage sections of the discovery report as compliance
  surfaces; owns the waiver annotations (`dlqAbsent`, `authAbsent`) that record accepted gaps.

### Discovery scanner (the automation actor)
- Owns every extractable fact: serverless DLQ/retry and authorizer declarations, flag-literal
  presence, rule source hashes. Runs locally against sibling repos; its report sections are
  the red-to-green driver for all backfill work.

---

## Core Features

### 1. Domain-rule cards

A `DomainRuleSchema` registry (`packages/data/src/rules.ts`, following the `teams.ts`
registry pattern) holds human-owned rule statements: `id`, `title`, `statement`,
`sourceOfTruth` (a code-unit ref), `divergences[]` (per platform — `backend | monolith |
web | mobile | tablet` — with behavior and optional code-unit ref), and `sourcePaths[]`.
Flow steps and code units reference rules via optional `ruleRefs`. Integrity tests enforce
referential resolution, path existence at authoring, and no orphan rules. In the flow modal,
steps carrying rules show a rule chip in the step list; clicking opens a rule card with the
divergence table. Ships with its flagship content: the overnight day-attribution and
clock-in/shift-coupling rules, authored from the prose currently threaded through three punch
flow files — svc-punch's `calculateOutAuto` named as source of truth, the web front's
client-side mirror recorded as a reimplementation, the tablet's offline-only open-badging
guard as a platform divergence. The platform enum deliberately includes backend/monolith:
the flagship rule's divergence set is not a three-client symmetry.

### 2. Rule staleness watch

Each rule carries `sourceHashes` (sha256 per `sourcePaths` entry, stamped at authoring). A
discovery-report section recomputes hashes against the sibling repos and prints "rule needs
re-review" with the changed path when a source file drifts. Human-owned meaning stays
human-owned; its currency becomes machine-watched. Statement text itself is never verified —
that boundary is by design.

### 3. Typed feature-flag registry

`FeatureFlagRefSchema { name, kind: product | dev, scope? }`, with optional `flags[]` on
code units and edges; `condition` remains for non-flag guards. `kind` is authored: it is
determined by the wrapping helper at the call site (`can_access?` = product,
`dev_flag_activated?` = dev) and is not derivable from the name — product flags without any
prefix exist (`ACCESS_LEGAL_WEEKLY_HOURS`, `MISSIONS_DEFAULT_SETTING_ON`). The flag→flows
registry is derived at build time, never authored. A discovery checker verifies each flag
name appears literally in the owning unit's source (the `unreferenced-callee` loop,
parametrized). ⌘K gains a flag entity type whose result lands on a flag view (new `flag`
URL param) listing the flows it gates, with chips in the code-detail view. Backfill: the 6
flag-carrying flows (5 named flags). Rollout state is permanently excluded — runtime data
belongs to the Phase 4 overlay.

### 4. Failure & resilience layer

Async code edges (`mode: async-job | async-event`) accept an optional
`failure { dlq?, retryPolicy?, onError?, dlqAbsent?: 'confirmed-missing' }` — `onError` is
human-owned narrative; `dlq`/`retryPolicy` are facts checked against extraction. The
serverless extractor gains DLQ/retry parsing across the three shapes present in the repos:
raw CloudFormation `RedrivePolicy` blocks, `createSqs({ dlqToAppend })` call-site arguments
(the factory materializes the policy once — presence is a per-call-site argument), and
`onFailure` destinations whose ARN is a `Fn::GetAtt` object. A 🧯 report section audits every
in-scope async edge: DLQ fact matching, or the explicit `confirmed-missing` waiver — which
ships with real content on day one (svc-requests' leave-request notification/mail queues have
no RedrivePolicy wiring despite same-named `*Dlq` queues nearby). Scope: edges targeting
services (~16); CDC/DMS edges are excluded as a different fault model. UI: the code-detail
view renders edge badges (this milestone introduces edge-label rendering — the current view
draws none), showing a DLQ shield or a warning state. `idempotent` is not a field anywhere:
no extractor can verify it.

### 5. Auth & permission context

Flows accept an optional `trigger { actor, role? }`; code edges accept an optional
`auth { tokenType, gate?, authAbsent? }` reusing the existing `AuthTypeSchema` enum for the
token half — authorizer names in the wild (`SkelloLambdaAuthorizerJwtOrApiKey`,
`…AllManagedUsers`) mix token type and permission tier, so the gate stays a separate
free-text fact. The serverless extractor captures `authorizer:` declarations in both live
syntaxes (bare string per function; object form in split resource files — the file walker
already visits both). A discovery checker verifies gate names appear in the owning
controller's source; the monolith side (`app/controllers/v3/api/` — 140 files, 531
authorize/can_* call sites) is human-authored with checker verification. `authAbsent`
records routes with no authorizer configured (21 such routes in svc-punch today) — absence
is representable, never inferred. Backfill inside the milestone: `trigger` on all 39 flows;
edge-level auth on the punch flows as flagship (the manager-login → token-employee →
shop-scoped-JWT chain as typed chips), with remaining coverage growing domain-by-domain and
reported like CODEOWNERS adoption. Token-lifecycle facts (the deliberately-reusable stale
tablet token) remain prose — a named schema boundary.

### 6. Flow composition links

Flows accept optional `links[] { to: flowId, kind: continuation | writes-back-to |
same-journey | domain-related }`; the reverse direction is derived at build time. The `kind`
is load-bearing: the 13 existing prose cross-references encode three distinct relationships
(the same journey split by platform, a literal continuation, and a domain write-back through
a different entry point — leave-request-approval's `/private/shifts` POST), and a flat id
array would collapse them into false equivalence. Links are authored, never extracted;
integrity tests verify id resolution only — causality stays a human claim. UI: "triggers →"
and "← triggered by" chips in the flow modal and flow list.

### 7. Generated inventory docs + authoring guide

A docs-gen module renders the dataset-derivable sections of `docs/flow-inventory.md` and
`docs/planning-actions-coverage.md` between `<!-- GENERATED -->` markers — flow counts and
lists, per-domain attribution (via a shared `getFlowDomains` util extracted from the web
layer), zero-flow-domain flags — leaving analysis prose hand-authored; the action-level
taxonomy in planning-actions-coverage has no schema representation and stays human-owned. A
new self-contained `pnpm check` gate fails when generated sections drift from the dataset.
The flow-authoring guide gains the code-layer chapter covering every field in this spec,
written last so it documents the final set.

### 8. Reverse code→flows index

A derived file→flows index folds over `codeUnits[].path` (237 of 239 units carry paths; the
dataset is fully client-resident at load) — zero new authored data. Tier one appends unit
paths to the flow entries' ⌘K haystack; tier two adds a `file` entity type whose result
lands on a view listing the flows traversing that path (new `file` URL param). The incident
question "which documented flows cross the file I'm changing?" becomes a ⌘K query.

### 9. PII surface (decorator-first)

Code edges accept an optional `pii` array naming the PII field classes their payload
carries. The authoring rule is absolute: a class is authorable only when the target
service's SDK types that field PII via `@skelloapp/lib-anonymizer` decorators
(`@RandomAnonymizer(EMAIL|FIRST_NAME|…)`, `@PasswordAnonymizer`, `@DeleteAnonymizer`) —
the 🧬 discovery section verifies every ref against the decorator scan. `@NoAnonymizer`
fields count as explicitly non-PII: the punch ClockInOut documents carry zero PII-typed
fields by design, and the map states that as machine-readable fact. The user-replication
hops (tablet first sync, periodic settings+users refresh, the badging-history userName)
carry the decorator-backed classes. The name-heuristic sweep over packages without
decorator coverage prints as review-assist in the report — the lib-anonymizer adoption
backlog, never dataset facts. 🧬 badges render on carrying edges in the code view.

---

## Technical Stack

- **Schema** — Zod in `packages/schema/src/index.ts`; all additions optional fields on
  `ServiceFlowSchema`, `ServiceFlowStepSchema`, `FlowCodeUnitSchema`, `FlowCodeEdgeSchema`,
  plus the new `DomainRuleSchema` and `FeatureFlagRefSchema`.
- **Dataset** — `packages/data`: `rules.ts` registry beside `teams.ts`/`domains.ts`;
  integrity gates in `integrity.test.ts`; backfill in `flows/*.ts`.
- **Discovery** — `packages/discovery`: serverless extractor extensions (DLQ/retry,
  authorizers), checker parametrizations of the `flow-check.ts` loop, the hash watch, the
  docs-gen module; report sections in `discover.ts` (🧯 and siblings).
- **Web** — `packages/web`: step-list chips + card panel, edge-badge rendering in
  `buildFlowCodeGraph.ts`/`FlowGraphModal.tsx`, ⌘K entity types + landing views in
  `searchIndex.ts`/`SearchModal.tsx` + `useUrlState.ts` (`rule`, `flag`, `file` params).
- **Delivery** — 8 milestones per `docs/improvements/roadmap.md`; M1/M4/M6/M7 start in
  parallel; every milestone merges independently `pnpm check`-green.
