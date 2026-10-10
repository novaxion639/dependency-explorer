# Data

## Principles

1. **Trust through provenance.** Drift between code and map is a bug, surfaced by tooling rather than discovered by accident. The integrity suite gates every change, and the discovery scanner reports drift in both directions: in code but not in the map, and in the map but not in code.
2. **Automation owns facts, humans own meaning.** Extractors own connections, endpoints, repo URLs and team ownership. Humans own flow narratives, product-area boundaries and descriptions. The two layers merge at build time, so regeneration never clobbers authored knowledge ([ADR-0004](../adr/0004-two-layer-data-model.md)).
3. **The documentation core is static.** Data lives in Git, versioned and reviewed. Writes happen through pull requests, including edits made later from the UI ([ADR-0003](../adr/0003-git-as-the-write-path.md)). Live operational data, when it arrives, is a read-only overlay joined by service ID at render time and never persisted into the dataset.

## Packages

| Package | Purpose |
|---|---|
| `packages/schema` | Zod schemas and inferred types: the single source of truth for the data model |
| `packages/data` | The dataset and its referential-integrity test suite (see below) |
| `packages/discovery` | The repo scanner: see [discovery.md](discovery.md) |
| `packages/web` | The static React + React Flow SPA: see [explorer.md](explorer.md) |

The dataset is imported at build time and validated by Zod on load. It holds:
- 37 services, 359 endpoints, and 150 connections (138 of them discovery-verified);
- 48 flows;
- 14 product areas plus 6 platform capabilities;
- 19 external systems and 12 teams.

## Monolith endpoint surface

All 763 `skello-app` routes are generated from `config/routes.rb` by `pnpm discover:apply`. They are held to the real router: a `bin/rails routes --expanded` fixture, whose 775/775 application triples are reproduced.

Each route is an endpoint, with `controller#action` as its default description. Human descriptions live in a keyed notes registry ([ADR-0009](../adr/0009-generated-api-surfaces.md)). Flow steps that cite monolith paths, and monolith controller units, are verified against this surface.

## Resource registry

`generated/resources.json` holds 523 generated resources:
- the 90 monolith tables from `db/schema.rb`, mapped to their ActiveRecord models (4 join/backup tables are model-less);
- queues, topics, streams, buckets and microservice stores from serverless config, Terraform and the dataset.

Ids are stable (`pg:skello_production.shifts`, `sqs:createActivityLogJob`). A queue name declared by two services yields one resource per owner.

Each resource carries graded relations computed at the pinned commit. Grades are `code`, `config` or `flow`.

**Monolith writers and readers:**
- Writers are class-level write calls such as `Shift.create!` or `Shift.where(…).update_all`, with comments stripped.
- Readers are call-graph references to the model.
- Instance writes (`record.save`) cannot be attributed statically and appear as reads.

**Consumers** are the services that read a queue, stream or bucket:
- the queues a service's `sqs:` events read, by arn literal or by `Fn::GetAtt` on a declared queue;
- every non-DLQ queue the owner declares, when one of its events names its queue through a parameter;
- Kinesis and S3 event sources.

**Producers** are repos naming the resource in a config or code string literal, under these rules:
- whole-token matches on distinctive names only;
- never in a comment, a log call's first argument, an object key or an index access;
- the owner counts through its code, never through its own serverless config;
- DMS tasks credit the repo whose database their production source endpoint reads.

**Dead-letter wiring** links each queue to its DLQ.

**CDC feeds** come from the `aws_dms_replication_task` resources in the `skello-app-tf` checkout. Each table a CDC task replicates has a `feeds` relation to that task's stream (`kinesis:skelloapp-bus`, grade `config`). A stream consumer whose event source filters on a table's `public.<table>.` prefix has a per-table `consumes` relation to that table (grade `config`). A prefix credits every table `t` for which `public.<t>.` starts with it, so `public.postes` credits `postes` and `postes_weekly_options`. A consumer without a table filter receives every table and is not credited per table.

The 🗄 discovery section reports registry drift at the pinned commit. The resource pages are described in [explorer.md](explorer.md#resource-pages).

## Table listener surface

`generated/listeners.json` holds the monolith's table listeners at the pinned skello-app commit:
- `listeners`: every callback, cascade, touch and gem listener, with its effects (216 at `3f6728f`);
- `writeSites`: every model write call across `app/` and `lib/`, classified by what it runs (796 at `3f6728f`);
- `pins`: the commit, `{ "skello-app": "<sha>" }`.

`ListenerSurfaceSchema` in `packages/schema` validates the file. `pnpm discover:apply` writes it, at the pinned commit only.

A listener's `id` is `<table>.<hook>.<name>`, for example `shifts.after_commit.update_paid_leaves`. Its `kind` is `callback`, `cascade`, `touch` or `gem`, and its `grade` is `code`, or `config` for a gem entry. Its effects write a table, enqueue a job or call a service, each with a `mode` (`sync` or `async-job`) and a grade:
- `graph`: the pinned graphify graph reaches the callee file from the listener's body within two hops;
- `constant`: the class is named literally;
- `text`: the receiver is tied to a model by name or association only (`user.update!`).

Write sites carry the same `constant` and `text` grades. At `3f6728f`, `shifts.after_commit.set_weekly_option_not_up_to_date` enqueues `ShiftCallbackJob`, whose `perform` calls `WeeklyOption.upsert_employee_change!`. That method writes `weekly_options` with raw SQL, so the write runs `none` and skips the listeners of `weekly_options`.

**`runs`** states which listeners a write site runs, under Rails 6.0.6.1 and activerecord-import 2.3.0 semantics:

| `runs` | Calls | Listeners that run |
|---|---|---|
| `all` | `save(!)`, `create(!)`, `update(!)`, `update_attribute`, `destroy(!)`, `destroy_all`, `find_or_create_by(!)`, `first_or_create(!)` | every listener whose `events` match; `update_attribute` saves with `validate: false`, so validation listeners do not run |
| `touch` | `touch`, `belongs_to … touch: true` | `after_touch`, then the commit and rollback listeners |
| `validation` | `import` / `import!` without `validate: false` | `before_validation` and `after_validation` only |
| `none` | `update_all`, `delete_all`, `delete`, `insert_all(!)`, `upsert_all`, `update_column(s)`, `import` with `validate: false`, raw SQL (`INSERT INTO`, `UPDATE … SET`, `DELETE FROM`) | none |
| `subset` | a hand-fire helper or `run_callbacks(:phase)` | the listeners named in `fires`; `run_callbacks(:commit)` fires the commit listeners, and `:save`, `:create`, `:update` and `:destroy` fire that chain's before and after listeners |

A table's listeners are listed in Rails execution order: validation, save and event callbacks, then commit and rollback. Within a phase they keep declaration order, except `after_commit` and `after_rollback`, which run in reverse declaration order.

## Contributing data

- **Flows:** follow the [flow authoring guide](../flow-authoring-guide.md). Every claim is verified against deployed code, never against documentation, and the integrity tests enforce the node naming conventions.
- **Coverage tracking:** [planning-actions-coverage.md](../planning-actions-coverage.md) lists which user actions are modelled and which are missing.
- **Checks:** every change must pass `pnpm check`, which CI enforces on every PR.
