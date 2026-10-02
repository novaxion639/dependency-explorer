# Skello Dependency Explorer

The canonical, continuously verified map of Skello's distributed architecture — every service, endpoint, connection, queue and business flow — **generated from code and deployed state, enriched by humans where automation can't reach**.

> **Status: Phase 2 complete — local POC with the full org-audience feature set.** Runs entirely on your machine with no backend and no external dependencies. Hosting, SSO and network integration are deliberately deferred until the approach is validated with the Infrastructure team and Architects (see [ADR-0005](docs/adr/0005-local-poc-first.md)). The architecture is hosting-agnostic by construction: the build output is a static bundle that can later sit behind any SSO proxy, ALB or CDN the supervising teams choose.

## What it shows

- **Service view** — for any of the 37 services (including the three client apps: Vue web front, skello-mobile and the SkelloPunchClock tablet, both React Native): its callers, callees and databases, with sync (REST) vs async (SQS/SNS/Kinesis) edge styling — including shared-database couplings (`mongodb`/`postgresql`), CDC replication edges (the `skelloapp-bus` DMS backbone and cross-service DynamoDB streams, discovered from serverless config) and `s3` bucket-notification couplings — the exact endpoints each connection uses, a CRUD-annotated endpoint drawer, and discovered recurring tasks (⏰ EventBridge schedules).
- **Product areas** — the landing page: 14 product areas (Planning, Time & attendance, Leave & requests…) plus the cross-cutting platform capabilities. Each area page answers what it is (glossary anchored to the defining classes), where it lives (verified code locations per platform with file counts), what to read first (an ordered reading path of flows), how it connects to other areas, and which external systems it relies on. Every flow carries a primary area; its full area set is derived from its code-unit paths (`?view=areas&area=planning`).
- **System context** — a C4-style picture: clients → monolith → services in one lane per area → data stores → external systems (`?view=context`).
- **Business flows** — 48 verified end-to-end flows (shift creation, auto-planning generation, leave lifecycle, tablet & mobile clock-in, device setup, mobile app launch, mobile-only shift swaps…) rendered as step-by-step DAGs including the AWS infrastructure each step touches (PostgreSQL, MongoDB, SQS, Lambdas, Step Functions, on-device SQLite queues). Page-load flows group steps into ordered phases; the punch flows carry the overnight-shop day-attribution rules on both client and server sides, and web-vs-mobile client divergences are recorded where the two implement the same feature differently.
- **Code-level flow detail** — flows can declare a *code layer*: the controllers, service objects, managers, Sidekiq jobs, model-callback groups — and, for client apps, UI components and HTTP client wrappers — an action traverses inside a service, with call semantics (sync / async-job, transaction boundaries, feature-flag and conditional guards) and table-level storage touches. The flow modal gains a `Services | Code detail` toggle (permalink: `?detail=code`). The layer is human-authored from code reading (assisted by `pnpm discover:trace <file>`) and machine-verified by `pnpm discover`: every unit's file path must exist (🫀 report section), and `--pinned` runs grade every unit→unit call edge from the graphify AST graph built at the pinned commit — `graph` (a calls/references path within two hops), `constant` (the caller names a class the callee file declares), `import` (an import resolves to the callee file), `text` (name match only — review backlog) or `none` (a finding). The code-detail view shows ✓ / ~ / ✗ per edge; a graph built at another commit is never used. Flows also declare **branches** — alternative outcomes (409 lock held, 422 not pending…) anchored to a code unit by a literal that 🔀 verifies in the pinned source. All 48 flows carry a code layer; flagships: the **Shift Creation** monolith path and the offline-first **Employee Clock-In** tablet path.
- **Sequence view** — the flow modal's third mode (`Services | Code detail | Sequence`, permalink `?detail=sequence`): participants (code units grouped under their service, services alone for flows without code edges) on lifelines, numbered messages in authored call order (solid sync, dashed async, CRUD / 🚩 flag / 🔑 auth badges), and an `alt` frame per branch after the message entering its unit — `[when] → outcome (status)`. Wide diagrams scroll inside the modal; clicking a participant opens its code-unit detail panel.
- **Domain-rule cards** — cross-flow business rules (overnight day attribution, clock-in/shift coupling) as first-class cards: a human-owned statement, a named source-of-truth code unit, and a per-platform divergence table (backend / monolith / web / mobile / tablet). Flow steps and code units reference rules; 📐 chips in the flow modal open the card. Integrity tests gate every ref; the discovery scanner verifies every rule source path on disk AND recomputes each path's sha256 staleness stamp — an upstream source change flags the rule "needs re-review" with the new hash to re-stamp (📐 report section).
- **Feature-flag registry** — typed flag refs on flow code units/edges (`kind` product|dev, authored from the call-site helper — never inferred from the name); the flag → flows registry is derived at build time. 🚩 chips in the flow modal, flags as a ⌘K entity type landing on the flows each flag gates (`?flag=FEATUREDEV_X`), and a 🚩 discovery section verifying every flag name appears literally in its unit's source.
- **Failure & resilience layer** — async code edges into services carry their failure semantics: the queue, its DLQ and retry policy (facts extracted from serverless config and the `*-tf` estate — RedrivePolicy blocks, `createSqs` factory args, `onFailure` destinations, Terraform `dlq_name`), an explicit `confirmed-missing` waiver where no DLQ wiring exists, and a human-owned `onError` narrative. 🛡/⚠ badges on the edges in the code-detail view; the 🧯 discovery section audits every in-scope edge and doubles as an org DLQ-standard audit.
- **Auth & permission context** — every flow states who triggers it (👤 chip in the flow modal; presence enforced by the integrity suite), and code edges carry typed auth refs: token type, permission gate (literal verified in the edge's unit sources), named gateway authorizer (verified against extracted serverless declarations — both syntaxes in the estate), or an explicit `no-authorizer-configured` record for in-lambda-auth routes. 🔑 chips on edges in the code view; 🔐 discovery section. Token-lifecycle facts stay prose — a named schema boundary.
- **Flow composition links** — kind-qualified relationships between flows (`continuation` · `writes-back-to` · `same-journey` · `domain-related`), authored one direction with the reverse derived; clickable chips in the flow modal turn the 13 former prose cross-references into navigation.
- **Monolith endpoint surface** — all 763 `skello-app` routes, generated from `config/routes.rb` by `pnpm discover:apply` and held to the real router (a `bin/rails routes --expanded` fixture: 775/775 application triples reproduced). Each route is an endpoint with `controller#action` as default description; human descriptions live in a keyed notes registry ([ADR-0009](docs/adr/0009-generated-api-surfaces.md)). Flow steps citing monolith paths and monolith controller units are verified against it.
- **Resource registry** — 288 generated resources (`generated/resources.json`): the 90 monolith tables from `db/schema.rb` mapped to their ActiveRecord models (4 join/backup tables are model-less), plus queues, topics, streams, buckets and microservice stores from serverless, Terraform and the dataset. Ids are stable (`pg:skello_production.shifts`, `sqs:createActivityLogJob`); a queue name declared by two services yields one resource per owner. Each resource carries graded relations computed at the pinned commit: monolith **writers** (class-level write calls such as `Shift.create!`, `Shift.where(…).update_all` — comments stripped) and **readers** (call-graph references to the model), queue/stream/bucket **consumers** (the owner's SQS event sources, Kinesis and S3 event sources), **producers** (other repos naming the resource in config or code, whole-token, distinctive names only) and **dead-letter** wiring; grades are `code`, `config` or `flow`. Instance writes (`record.save`) are not attributable statically and appear as reads. The 🗄 discovery section reports registry drift at the pinned commit.
- **Resource pages** — `?resource=<id>` answers the change-impact question for one table, queue, topic, stream, bucket or store: "N services · M files · K flows", then writers, readers, producers and consumers grouped by service with ✓ (code / config evidence) or ~ (authored flow edge only), the DLQ, the ActiveRecord model and related tables, and the flows touching it with their CRUD. `?view=resources` lists every resource by store with a kind filter and a "not in any flow" toggle (the adoption backlog). Entry points: ⌘K resource entities, database nodes in the flow, code and service graphs, and file views ("resources this file touches").
- **Reverse code→flows index** — ⌘K accepts a source-file path and answers "which documented flows traverse this file, and which routes does it serve?" (`?file=skello-app/app/controllers/v3/api/plannings/shifts_controller.rb`) — derived from the code layer's unit paths and the monolith routes; a route opens the endpoint drawer.
- **PII surface (decorator-first)** — code edges declare the PII field classes their payload carries (`pii: ["email", "firstName", …]`), authored ONLY where the target SDK types the field via `@skelloapp/lib-anonymizer` decorators; the 🧬 discovery section verifies every ref against the decorator scan, counts the explicitly-non-PII surface (`@NoAnonymizer` — the punch documents themselves carry none, by design), and lists name-heuristic candidates in packages without decorator coverage as the decorator-adoption backlog — review-assist, never facts. 🧬 badges on the carrying edges.
- **Code-unit detail panels** — clicking a node in the code-detail view opens the unit's full story: unclamped description, GitHub source link, the domain rules it implements (click-through to the rule card), its flags, every call edge with the edge's mode/guard/transaction/CRUD and 📜🔑🧬🛡 annotations, and the other flows crossing the same file (click-through).
- **Blast radius** — BFS over the dependency graph showing which services are affected if a service fails.
- **Permalinks** — every view state (area page and glossary term, selected service, connection popup, endpoint drawer, flow, blast radius) is encoded in the URL: copy the link, share it in Slack or a PR, and the recipient lands on the exact same view.
- **Global search (⌘K)** — one palette over every service, endpoint, connection, flow, product area, glossary term, external system, database and queue. Picking a result navigates to a permalink-backed view — an endpoint hit opens the drawer scrolled to that endpoint.
- **PNG export** — every graph (service view, flow DAGs) exports the full laid-out graph as a 2× PNG for RFCs, arch reviews and incident docs.
- **Ownership view** — per-team service ownership resolved from CODEOWNERS: a service is assigned to a team when its wildcard (`*`) line names exactly one product team (path-rule frequency is not ownership; process squads and the team-dev catch-all are excluded). Team pages are permalink-backed (`?view=teams&team=team-salsa`) and searchable from ⌘K; each owned service shows its CODEOWNERS evidence chips, connection counts and a jump into the graph. Services without a resolved owner are listed as the adoption call-to-action — coverage grows with zero code changes as teams add CODEOWNERS wildcards.

## Quickstart

```bash
pnpm install
pnpm dev        # → http://localhost:5173
```

That's it. No database, no seeding, no Docker: the dataset is imported at build time and validated by Zod on load.

## Workspace layout

| Package | Purpose |
|---|---|
| `packages/schema` | Zod schemas + inferred types — the single source of truth for the data model |
| `packages/data` | The dataset (37 services, 359 endpoints, 150 connections — 138 of them discovery-verified — 48 flows, 14 product areas + 6 platform capabilities, 19 external systems, 12 teams) + referential-integrity test suite |
| `packages/discovery` | Repo scanner: detects drift between the dataset and sibling repos — SDK usage, serverless config (HTTP, SQS, Kinesis/DynamoDB streams, S3 triggers, EventBridge schedules), application-code AWS clients (Kinesis/Firehose/S3/DynamoDB/TypeORM direction vs `service.databases`), Terraform ground truth (`<service>-tf` checkouts: owned resources, DMS replication tasks, IAM actions), Rails clients/routes, frontend env usage, product-area code locations — glob liveness, monolith/front/mobile coverage, glossary anchors, external-system evidence (`pnpm discover`), and Layer 4 live AWS verification — a read-only account snapshot (event source mappings, subscriptions + filter policies, DMS tasks, bucket notifications, schedules) diffed against the map (`pnpm discover -- --aws`; snapshots are gitignored, sandbox account only per the credentials story in the shared docs) |
| `packages/web` | Static React + React Flow SPA — the visualization |

## Principles

1. **Trust through provenance.** Drift between code and map is a bug, surfaced by tooling — not discovered by accident. The integrity suite gates every change; the discovery scanner reports both directions of drift (in code but not in map, in map but not in code).
2. **Automation owns facts, humans own meaning.** Extractors will own connections, endpoints, repo URLs and team ownership (Phase 1); humans own flow narratives, product-area boundaries and descriptions. The two layers merge at build time so regeneration never clobbers authored knowledge.
3. **The documentation core is static.** Data lives in Git, versioned and reviewed. Writes happen through pull requests — including, later, edits made from the UI (see [ADR-0003](docs/adr/0003-git-as-the-write-path.md)). Live operational data, when it arrives, is a read-only overlay joined by service ID at render time — never persisted into the dataset.

## Commands

```bash
pnpm dev             # run the app locally
pnpm build           # typecheck + production build (static bundle in packages/web/dist)
pnpm typecheck       # typecheck all packages
pnpm test            # data integrity + discovery mapping suites
pnpm discover        # scan sibling Skello repos → classified drift report
pnpm discover:apply  # pinned run + regenerate the discovered overlay (provenance stamps, call-edge grades) and the monolith routes; --apply refuses to run unpinned
pnpm discover -- --pinned   # same, against each repo's production branch (master; main for *-tf) as detached worktrees in .pinned/
pnpm discover:baseline      # pinned run + rewrite packages/discovery/baseline.json (accepted findings and scanned repo set)
pnpm discover -- --pinned --fail-on-new   # exit 1 when a finding is not in the baseline
pnpm discover -- --aws [dir]   # + 🛰 live AWS snapshot diff (defaults to the latest snapshot)
pnpm discover:aws:fetch --profile skl-sandbox   # capture a read-only snapshot (~215 calls, MFA'd session required)
pnpm docs:gen        # rewrite the generated sections of the inventory docs (CI fails on drift)
pnpm check           # everything CI runs
```

### Nightly discovery

`.github/workflows/discovery-nightly.yml` runs every night at 03:00 UTC and on manual dispatch. It clones every repo `pnpm --filter @dependency-explorer/discovery repo-list` prints (the baseline's scanned set plus every dataset service and its `-tf` repo) at its production branch with the `DISCOVERY_READ_TOKEN` repository secret (org read access), then runs `pnpm discover -- --pinned --fail-on-new`. The report is the job summary and the `discovery-report` artifact. The job is red when a finding is new against `packages/discovery/baseline.json`; it opens no pull requests. Accepting drift is a reviewed commit of `pnpm discover:baseline`. Without the secret the job fails at its first step with `secret DISCOVERY_READ_TOKEN not configured`.

## Contributing data

- **Flows**: follow [docs/flow-authoring-guide.md](docs/flow-authoring-guide.md) — every claim verified against deployed code, never against documentation. Node naming conventions are enforced by the integrity tests.
- **Coverage tracking**: [docs/planning-actions-coverage.md](docs/planning-actions-coverage.md) lists which user actions are modelled vs missing.
- All changes must pass `pnpm check` (CI enforces this on every PR).

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Reboot: static SPA, workspace structure, integrity gates, CI | ✅ done |
| 1 | Automation-first: SDK + Rails + CODEOWNERS extractors, provenance metadata, two-layer merge, classified drift report ([ADR-0007](docs/adr/0007-discovery-semantics.md)) | ✅ done (nightly drift PRs pending org token — Infra discussion) |
| 1.5 | More extractors: serverless configs (deploy-state + static, endpoint verification), Rails routes (monolith inbound surface), frontend env/usage, async queue cross-reference | ✅ done — Layer 4 live AWS verification ships as the `aws-live` extractor (`pnpm discover -- --aws`): sandbox snapshot diff, every CDC edge live-confirmed 2026-07-18, one new edge adopted; credentials story in the shared docs (`research/aws-live-verification-credentials.md`), nightly automation pending the Infra role |
| 1.7 | AWS resource discovery — Layer 1: stream/S3/schedule event sources + owned CloudFormation resources from serverless config (🌀 report section, `RecurringTask` model, CDC backbone edges). Layer 2: application-code AWS client usage (🔧 section — Kinesis/Firehose produce, S3 read/write, DynamoDB CRUD, TypeORM Postgres coupling, two-way drift vs `service.databases`). Layer 3: Terraform ground truth (🏗 section — the org's `<service>-tf` estate: owned data resources, DMS replication tasks proving the aurora → kinesis CDC backbone, data-plane IAM actions) | ✅ done |
| 2 | Org-audience features: permalinks, global search, ownership pages, export | ✅ done — the ownership view renders whatever CODEOWNERS coverage exists (2/35 services today, team-salsa); coverage grows through org adoption, not code |
| 3 | "Suggest edit" → pre-filled PR via GitHub App, permissions from GitHub teams | |
| 4 | Live operational overlays (deploys, alarms, queue depth, on-call) via a read-only API | |

Architecture decisions are recorded in [docs/adr/](docs/adr/).
