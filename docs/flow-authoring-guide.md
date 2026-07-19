# Flow Authoring Guide

Reference document for building accurate dependency-explorer flow definitions.
Derived from the AI Auto-Planning Generation flow (svc-automatic-scheduling) — the first flow built with full code verification and step-by-step domain-expert validation.

This document serves as a **skill/template** for agents or contributors authoring flows for other Skello microservices.

---

## 1. Methodology

### 1.1 Source of truth is deployed code, not documentation

Every claim in a flow must be verified against:

1. **The microservice source code** — `serverless.ts`, handlers, managers, repositories, `container.ts` (DI wiring)
2. **The monolith source code** (skello-app) — `routes.rb`, controllers, services, serializers
3. **AWS deployed state** — Lambda functions, SQS queues, Step Functions, S3 buckets visible on the target environment (e.g. sandbox via `aws --profile skl-development-local`)

Never rely on:
- READMEs, Confluence pages, or prior flow definitions (they drift)
- SDK package names as proof of HTTP calls (SDKs are often imported for types only)
- Assumed architecture (e.g. "this service probably calls that service")

### 1.2 Validation loop

For each step in the flow:

1. List **every external call** the Lambda/handler makes (HTTP, DB read/write, SQS send, SDK invoke)
2. Present the list to a domain expert for validation
3. Only move to the next step after explicit sign-off
4. If the expert corrects an assumption, verify the correction in code before applying

---

## 2. Node Naming Conventions

### 2.1 Service nodes (appear in `steps`)

| Pattern | When to use | Example |
|---|---|---|
| `svc-{name}` | Deployed microservice | `svc-automatic-scheduling` |
| `skello-app` | Rails monolith | `skello-app` |
| `skello-app-front` | Vue2 frontend | `skello-app-front` |
| `sfn-{stepName}` | Internal Lambda step within a Step Functions pipeline | `sfn-dataFetcher`, `sfn-solver` |
| `{service} ({role})` | Same service appearing multiple times with distinct roles | `skello-app (data)`, `skello-app (assign)` |
| `{service} ({qualifier})` | Duplicate node for the same service in a different flow position | `skello-app-front (notify)` |

**Rule: When a service performs two distinct roles in the same flow (e.g. serving GET reads and receiving PATCH writes), split it into two nodes with role qualifiers so each gets its own infra nodes underneath.**

### 2.2 Infra node IDs

| Pattern | When to use | Example |
|---|---|---|
| `{type}-{owner}` | Infra node scoped to a specific Lambda step | `mongo-jobs-dataFetcher`, `sqs-ws-eligibility` |
| `{type}-{service}` | Infra node scoped to a service | `pg-skello-read`, `mongo-svc-search` |
| `{type}-{purpose}` | Shared or unique infra | `sqs-metrics` |

**Rule: Never share infra nodes across Lambda steps. Each Lambda gets its own instance of every infra resource it calls.** This ensures infra nodes are placed directly underneath their parent Lambda in the flow graph layout (the `buildFlowGraph` layout engine places infra nodes below the first service that references them via an `infraEdge`).

---

## 3. Step Rules

### 3.1 HTTP request-response pairs

When a service makes an HTTP call and the response carries meaningful data (not just a 200 OK), represent both the request and response as separate steps:

```json
{ "from": "skello-app-front", "to": "svc-automatic-scheduling",
  "action": "Trigger — POST /api/auto_scheduling/compute → { websocketId }" },
{ "from": "svc-automatic-scheduling", "to": "skello-app-front",
  "action": "HTTP 200 {websocketId} — frontend opens WebSocket channel" }
```

This makes the response payload visible in the step legend.

### 3.2 Step Functions internal steps

When a microservice orchestrates work through AWS Step Functions, each Lambda step in the state machine becomes a **first-class node** in the flow:

- Use `sfn-{camelCaseName}` as the node name (matches the serverless function logical name)
- Connect them in sequence: `sfn-dataFetcher → sfn-eligibility → sfn-aggregate → ...`
- The orchestrating service (`svc-automatic-scheduling`) connects to the first SFN step
- External HTTP calls from inside SFN steps are separate step edges: `sfn-dataFetcher → skello-app (data)`

### 3.3 Action label format

Action labels should follow this pattern:

```
{HTTP_METHOD} {path} — {what it reads/writes} ({source database if relevant})
```

Examples:
- `GET private/svc_shops/shops/:id — shop, teams, postes, contract_types (from PostgreSQL)`
- `PATCH /v3/api/plannings/shifts — update shifts, badgings, shift_swaps in PostgreSQL`
- `SFN step 4 — Python CP-SAT optimizer (10 GB RAM, 15 min timeout, no external calls)`

For SFN-internal transitions, prefix with the step number:
- `SFN step 2 — parallel Map: compute eligibility for each employee batch (pure in-memory)`

### 3.4 Monolith endpoint verification

When a flow involves `skello-app` endpoints:

1. Check `config/routes.rb` for the actual route — paths in SDK clients or microservice code are often wrong or outdated
2. Read the controller to identify which PostgreSQL tables are queried (via ActiveRecord models, `.find`, `.where`, `.includes`, eager loads)
3. For write endpoints, check whether the operation runs inside a `transaction` block and list all tables modified (including cascading deletes, soft-deletes, and after-commit side effects)

---

## 4. Infra Node Rules

### 4.1 One infra node per Lambda per resource

**Do not share infra nodes across multiple Lambda steps.** Instead, create a dedicated infra node for each Lambda that touches the resource.

Why: the flow graph layout engine (`buildFlowGraph.ts`) places infra nodes below the **first service that references them** via an `infraEdge`. Shared nodes end up under only one Lambda, with long crossing edges from other Lambdas — cluttering the graph.

Example — `automatic_scheduling_jobs` MongoDB (used by 6 Lambdas):
```json
{ "id": "mongo-jobs-trigger", "type": "mongodb", "label": "automatic_scheduling_jobs",
  "description": "Create job record (status: STARTED)" },
{ "id": "mongo-jobs-dataFetcher", "type": "mongodb", "label": "automatic_scheduling_jobs",
  "description": "Update job status → DATA_FETCHING" },
{ "id": "mongo-jobs-eligibility", "type": "mongodb", "label": "automatic_scheduling_jobs",
  "description": "Update job status → ELIGIBILITY_COMPLIANCE_CHECK" }
```

Each has a unique `id` but the same `label` (which is the user-visible name on the node). The `FlowGraphModal` infra legend deduplicates by `type:label`, so the legend still shows one entry.

### 4.2 Separate read and write instances for the same database

When a service reads from a database in one step and writes to it in another, create two infra nodes:

```json
{ "id": "pg-skello-read",  "type": "postgresql", "label": "skello_production (RDS)",
  "description": "Read shops, teams, postes, users, contracts, memberships, licenses" },
{ "id": "pg-skello-write", "type": "postgresql", "label": "skello_production (RDS)",
  "description": "Write shifts, badgings, shift_swaps, shift_replacements in a transaction" }
```

This ensures the CRUD badges (`R` vs `U D`) are distinct and each node is placed under the correct service role node.

### 4.3 Infra node types

Use the `DatabaseTypeSchema` enum values. The UI assigns colors and icons automatically:

| Type | Color | Icon | Use for |
|---|---|---|---|
| `postgresql` | #336791 | elephant | RDS / Aurora PostgreSQL |
| `mongodb` | #4db33d | leaf | MongoDB Atlas / DocumentDB |
| `redis` | #dc382d | lightning | ElastiCache Redis |
| `dynamodb` | #f59e0b | diamond | DynamoDB tables |
| `s3` | #569a31 | cabinet | S3 buckets |
| `sqs` | #e0761b | envelope | SQS queues |
| `sns` | #b0631a | megaphone | SNS topics |
| `kinesis` | #9b59b6 | wave | Kinesis streams |
| `lambda` | #f97316 | lambda | Lambda functions / Step Functions |
| `elasticsearch` | #00bfb3 | magnifier | Elasticsearch / OpenSearch |
| `cdc` | #ec4899 | lightning | Change Data Capture streams |

### 4.4 CRUD labels on infra edges

Always include a `crud` array on infra edges. These render as colored badges on the database node:

| Operation | Badge color | When to use |
|---|---|---|
| `create` | green | INSERT, SQS SendMessage, S3 PutObject |
| `read` | blue | SELECT, SQS ReceiveMessage, S3 GetObject |
| `update` | amber | UPDATE, MongoDB updateOne |
| `delete` | red | DELETE, soft-delete, destroy_all |

---

## 5. Verification Checklist

For each Lambda/handler in the flow, verify against the source code:

- [ ] **HTTP calls**: Check the manager/client classes for `axios`, `fetch`, or SDK HTTP client usage. Verify the actual URL path matches `routes.rb` (for skello-app) or the target service's `serverless.ts` functions
- [ ] **Database reads**: Check which repositories are injected via `container.ts`. Trace each repository to its collection/table. Note: SDK imports used only for types (not HTTP calls) do not count as connections
- [ ] **Database writes**: Check for `.update()`, `.create()`, `.delete()`, `.save()` calls. For Rails, check the service class for `transaction` blocks
- [ ] **SQS sends**: Search for `sendMessage`, `SendMessageCommand`, or repository classes that wrap SQS. Note the queue name from env vars
- [ ] **WebSocket notifications**: Check if the handler calls `updateJobStatusAndNotify()` or equivalent. Record the status string sent
- [ ] **What it does NOT call**: Explicitly note when a Lambda makes no external calls (e.g. the Python solver). This prevents future contributors from adding phantom connections

---

## 6. Patterns Discovered

### 6.1 WebSocket progress tracking

Skello microservices using Step Functions follow this pattern:
1. The trigger endpoint returns a `websocketId` (UUID) in the HTTP response
2. The frontend opens a WebSocket channel using this ID
3. Every SFN Lambda step sends a status notification to `websocket-genericMessage` SQS with payload `{ uuid, data: { message: "<STATUS>" } }`
4. Exception: Python Lambdas have no access to the TS notification system. The preceding TS Lambda pre-sends the next status on their behalf

### 6.2 Direct MongoDB cross-service reads

Some microservices bypass HTTP APIs and read directly from another service's MongoDB over VPC (e.g. `svc-automatic-scheduling` reads from `svc-search`'s `shifts` and `rawPoste` collections). These are real connections that should be represented, but with the description noting "direct VPC read, no HTTP".

### 6.3 Context passing via SFN state (not S3)

Even when an S3 bucket exists for "SFN context" (e.g. `svc-automatic-scheduling-sfn-ctx`), verify whether it's actually used. In the auto-scheduling flow, context passes entirely through the SFN state payload — the S3 bucket exists but the `S3ContextRepository` is not wired into any handler. Always check `container.ts` DI wiring, not just the existence of a repository class.

### 6.4 Monolith endpoint table fan-out

A single Rails endpoint often touches 10+ PostgreSQL tables through ActiveRecord eager loading (`.includes`, `.joins`). List the key tables in the infra node description and the action label. Focus on tables that carry business data (skip join tables unless they're explicitly queried).

---

## 7. Schema Reference

Every field a flow can carry, with the machine check each one answers to.
Two invariants: every field below `steps` is optional at the schema level
(the integrity suite enforces dataset conventions like trigger presence),
and source-verifying checks run under `pnpm discover` (sibling repos on
disk) — CI gates only self-contained integrity.

### 7.1 Flow-level

```typescript
ServiceFlowSchema = {
  id, name, description,
  trigger: { actor, role? },        // who initiates — PRESENCE ENFORCED by integrity tests
  links: [{ to, kind, note? }],     // flow-to-flow: continuation | writes-back-to |
                                    // same-journey | domain-related. One direction authored,
                                    // reverse derived. Integrity: ids resolve, no self/double links
  steps, infraNodes, infraEdges,    // the macro DAG (§2-4)
  codeUnits, codeEdges,             // the code layer (§7.2)
}

ServiceFlowStepSchema = {
  from, to, action,
  phase?,                           // page-load flows: ordered lanes
  ruleRefs?: [ruleId],              // domain rules governing the step (📐 chips)
}
```

### 7.2 Code layer

The controllers, service objects, managers, jobs, model-callback groups —
and for client apps, UI components and HTTP client wrappers — an action
traverses inside a service. Human-authored from code reading
(`pnpm discover:trace <file>` assists); machine-verified by 🫀: every
`path` must exist in the sibling checkout, every unit→unit edge's callee
constant must be referenced from the caller's file.

```typescript
FlowCodeUnitSchema = {
  id, service, kind,                // controller | service | manager | job |
                                    // model-callback | component | client
  label,                            // the constant — its longest Capitalized token is
                                    // the 🫀 reference check; lowercase-only labels skip it
  path?,                            // repo-relative — existence checked (🫀)
  description?,
  ruleRefs?: [ruleId],              // rules this unit implements/mirrors (📐)
  flags?: [{ name, kind, scope? }], // flag literals verified in THIS unit's source (🚩)
}

FlowCodeEdgeSchema = {
  from, to,                         // unit id, service name, or infra-node id
  label?, mode?,                    // sync | async-job | async-event
  condition?,                       // free-text guard ("absence shifts only")
  inTransaction?, crud?,
  flags?: [{ name, kind, scope? }], // flag gating the call — literal verified in the
                                    // caller's OR callee's source (🚩); kind is authored
                                    // from the call-site helper, never name-derived
  failure?: {                       // async edges only (integrity-enforced)
    queue?, dlq?, retryPolicy?,     // facts — dlq matched against extracted serverless/tf
                                    // wiring (🧯); waiver cross-checked for staleness
    dlqAbsent?,                     // 'confirmed-missing' — no DLQ wiring exists, recorded
    onError?,                       // human-owned narrative — what a lost message means
  },
  auth?: {                          // what authenticates the hop (🔐)
    tokenType?,                     // jwt | api-key | internal | iam-role | none
    gate?,                          // permission predicate — literal verified in unit sources
    authorizer?,                    // named gateway authorizer — verified against config
    authAbsent?,                    // 'no-authorizer-configured' — in-lambda auth, recorded
  },
}
```

### 7.3 Domain rules (registry)

Cross-flow business rules live in `packages/data/src/rules.ts`
(`DomainRuleSchema`): a human-owned `statement`, a `sourceOfTruth` code-unit
ref, per-platform `divergences` (`backend | monolith | web | mobile |
tablet`), `sourcePaths` (existence checked, 📐) and `sourceHashes` (sha256
stamps — a drifted source flags the rule "needs re-review" with the
re-stamp hash printed). Stamp completeness is integrity-enforced.

### 7.4 Infra nodes/edges

```typescript
FlowInfraNodeSchema = { id, type: DatabaseTypeSchema, label, description? }
FlowInfraEdgeSchema = { from, to, label?, crud? }
```

### 7.5 Which check answers to what

| Check | Where it runs | What it proves |
|---|---|---|
| integrity tests | `pnpm check` / CI | ids unique, every ref resolves, trigger present, stamps complete, field invariants |
| 🫀 code layers | `pnpm discover` | unit paths exist, callees referenced from caller sources |
| 📐 domain rules | `pnpm discover` | rule sources exist + staleness hashes match |
| 🚩 flag refs | `pnpm discover` | flag literals present in unit sources |
| 🧯 failure layer | `pnpm discover` | DLQ facts match serverless/Terraform wiring; waivers not stale; unannotated async edges listed |
| 🔐 auth context | `pnpm discover` | gates in source, authorizers declared in config |
| docs-gen gate | `pnpm check` / CI | generated inventory sections match the dataset (`pnpm docs:gen` on drift) |

---

## 8. Reference Implementation

See `src/data/flows/auto-planning-generation.ts` — the first flow built using this guide. It demonstrates:

- 12 step edges (trigger, response, 6 SFN Lambda transitions, 3 HTTP calls, 1 final notification)
- 15 infra nodes (1 per Lambda per resource, split read/write for PostgreSQL)
- 15 infra edges (each with explicit CRUD labels)
- Correct endpoint paths verified against `routes.rb`
- Per-Lambda WebSocket SQS notifications with status messages
- Python solver with no external calls (explicitly documented)
