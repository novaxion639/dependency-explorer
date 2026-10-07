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

The 🗄 discovery section reports registry drift at the pinned commit. The resource pages are described in [explorer.md](explorer.md#resource-pages).

## Contributing data

- **Flows:** follow the [flow authoring guide](../flow-authoring-guide.md). Every claim is verified against deployed code, never against documentation, and the integrity tests enforce the node naming conventions.
- **Coverage tracking:** [planning-actions-coverage.md](../planning-actions-coverage.md) lists which user actions are modelled and which are missing.
- **Checks:** every change must pass `pnpm check`, which CI enforces on every PR.
