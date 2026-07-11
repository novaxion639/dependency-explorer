# Skello Dependency Explorer

The canonical, continuously verified map of Skello's distributed architecture — every service, endpoint, connection, queue and business flow — **generated from code and deployed state, enriched by humans where automation can't reach**.

> **Status: Phase 2 — local POC, org-audience features in progress.** Runs entirely on your machine with no backend and no external dependencies. Hosting, SSO and network integration are deliberately deferred until the approach is validated with the Infrastructure team and Architects (see [ADR-0005](docs/adr/0005-local-poc-first.md)). The architecture is hosting-agnostic by construction: the build output is a static bundle that can later sit behind any SSO proxy, ALB or CDN the supervising teams choose.

## What it shows

- **Service view** — for any of the 35 services: its callers, callees and databases, with sync (REST) vs async (SQS/SNS/Kinesis) edge styling — including shared-database couplings (`mongodb`/`postgresql`) and CDC replication edges (the `skelloapp-bus` DMS backbone and cross-service DynamoDB streams, discovered from serverless config) — the exact endpoints each connection uses, a CRUD-annotated endpoint drawer, and discovered recurring tasks (⏰ EventBridge schedules).
- **Domain view** — 8 bounded contexts with aggregated cross-domain dependencies.
- **Business flows** — 33 verified end-to-end flows (shift creation, auto-planning generation, leave lifecycle…) rendered as step-by-step DAGs including the AWS infrastructure each step touches (PostgreSQL, MongoDB, SQS, Lambdas, Step Functions). Page-load flows group steps into ordered phases.
- **Code-level flow detail** — flows can declare a *code layer*: the controllers, service objects, managers, Sidekiq jobs and model-callback groups an action traverses inside a service, with call semantics (sync / async-job, transaction boundaries, feature-flag and conditional guards) and table-level storage touches. The flow modal gains a `Services | Code detail` toggle (permalink: `?detail=code`). The layer is human-authored from code reading (assisted by `pnpm discover:trace <file>`) and machine-verified by `pnpm discover`: every unit's file path must exist and every call edge's callee must be referenced from its caller's source (🫀 report section). All 33 flows carry a code layer; flagship: the **Shift Creation** flow's full monolith path.
- **Blast radius** — BFS over the dependency graph showing which services are affected if a service fails.
- **Permalinks** — every view state (selected service, connection popup, endpoint drawer, flow, domain filter, blast radius) is encoded in the URL: copy the link, share it in Slack or a PR, and the recipient lands on the exact same view.
- **Global search (⌘K)** — one palette over every service, endpoint, connection, flow, domain, database and queue (~600 entries). Picking a result navigates to a permalink-backed view — an endpoint hit opens the drawer scrolled to that endpoint.
- **PNG export** — every graph (service view, domain view, flow DAGs) exports the full laid-out graph as a 2× PNG for RFCs, arch reviews and incident docs.

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
| `packages/data` | The dataset (35 services, 346 endpoints, 132 connections — 115 of them discovery-verified — 33 flows, 8 domains, 12 teams) + referential-integrity test suite |
| `packages/discovery` | Repo scanner: detects drift between the dataset and sibling repos — SDK usage, serverless config (HTTP, SQS, Kinesis/DynamoDB streams, S3 triggers, EventBridge schedules), application-code AWS clients (Kinesis/Firehose/S3/DynamoDB/TypeORM direction vs `service.databases`), Terraform ground truth (`<service>-tf` checkouts: owned resources, DMS replication tasks, IAM actions), Rails clients/routes, frontend env usage (`pnpm discover`) |
| `packages/web` | Static React + React Flow SPA — the visualization |

## Principles

1. **Trust through provenance.** Drift between code and map is a bug, surfaced by tooling — not discovered by accident. The integrity suite gates every change; the discovery scanner reports both directions of drift (in code but not in map, in map but not in code).
2. **Automation owns facts, humans own meaning.** Extractors will own connections, endpoints, repo URLs and team ownership (Phase 1); humans own flow narratives, domain boundaries and descriptions. The two layers merge at build time so regeneration never clobbers authored knowledge.
3. **The documentation core is static.** Data lives in Git, versioned and reviewed. Writes happen through pull requests — including, later, edits made from the UI (see [ADR-0003](docs/adr/0003-git-as-the-write-path.md)). Live operational data, when it arrives, is a read-only overlay joined by service ID at render time — never persisted into the dataset.

## Commands

```bash
pnpm dev             # run the app locally
pnpm build           # typecheck + production build (static bundle in packages/web/dist)
pnpm typecheck       # typecheck all packages
pnpm test            # data integrity + discovery mapping suites
pnpm discover        # scan sibling Skello repos → classified drift report
pnpm discover:apply  # same + regenerate the discovered overlay (provenance stamps)
pnpm check           # everything CI runs
```

## Contributing data

- **Flows**: follow [docs/flow-authoring-guide.md](docs/flow-authoring-guide.md) — every claim verified against deployed code, never against documentation. Node naming conventions are enforced by the integrity tests.
- **Coverage tracking**: [docs/planning-actions-coverage.md](docs/planning-actions-coverage.md) lists which user actions are modelled vs missing.
- All changes must pass `pnpm check` (CI enforces this on every PR).

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Reboot: static SPA, workspace structure, integrity gates, CI | ✅ done |
| 1 | Automation-first: SDK + Rails + CODEOWNERS extractors, provenance metadata, two-layer merge, classified drift report ([ADR-0007](docs/adr/0007-discovery-semantics.md)) | ✅ done (nightly drift PRs pending org token — Infra discussion) |
| 1.5 | More extractors: serverless configs (deploy-state + static, endpoint verification), Rails routes (monolith inbound surface), frontend env/usage, async queue cross-reference | ✅ done (AWS read-only verification remains — needs credentials story) |
| 1.7 | AWS resource discovery — Layer 1: stream/S3/schedule event sources + owned CloudFormation resources from serverless config (🌀 report section, `RecurringTask` model, CDC backbone edges). Layer 2: application-code AWS client usage (🔧 section — Kinesis/Firehose produce, S3 read/write, DynamoDB CRUD, TypeORM Postgres coupling, two-way drift vs `service.databases`). Layer 3: Terraform ground truth (🏗 section — the org's `<service>-tf` estate: owned data resources, DMS replication tasks proving the aurora → kinesis CDC backbone, data-plane IAM actions) | ✅ done |
| 2 | Org-audience features: permalinks, global search, ownership pages, export | 🚧 — permalinks ✅, ⌘K search ✅, PNG export ✅; ownership pages blocked on teamId coverage (CODEOWNERS wildcard adoption) |
| 3 | "Suggest edit" → pre-filled PR via GitHub App, permissions from GitHub teams | |
| 4 | Live operational overlays (deploys, alarms, queue depth, on-call) via a read-only API | |

Architecture decisions are recorded in [docs/adr/](docs/adr/).
