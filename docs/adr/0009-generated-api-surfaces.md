# ADR-0009: Extracted API surfaces are generated entities

**Status:** accepted — 2026-10-01. Amends [ADR-0007](0007-discovery-semantics.md) §1.

## Context

The monolith exposes 763 routes (`bin/rails routes` at master). An authored endpoint list of that size would rot on the first routes change, and an empty one blocks every check that resolves a flow step or a controller against the monolith. ADR-0007 §1 forbids discovery from adding entities.

## Decision

1. An API surface extracted from source (the monolith's `config/routes.rb` and `config/routes/*.rb`) is a **generated entity set**: `pnpm discover:apply` writes `packages/data/src/generated/monolith-routes.json`, and the data layer loads each route as a `skello-app` endpoint with `provenance.source: 'discovered'`. The id is `"<VERB> <path>"`, and the default description is `controller#action`.
2. Meaning stays in flows: a route's description is its `controller#action`, and the narrative of what it does lives in the flows that cite it.
3. Flows, connections and all narrative remain human-adopted. ADR-0007 §1 holds for every other entity.
4. The parser is held to the router: a `bin/rails routes --expanded` dump at a recorded commit is a test fixture, and the parser reproduces at least 98 % of its `verb + path + controller#action` triples.
5. The resource registry (`packages/data/src/generated/resources.json`) is a generated entity set: monolith tables from `db/schema.rb` with their ActiveRecord models, queues, topics, streams and buckets from serverless and Terraform declarations, and microservice stores from `service.databases`. The 🗄 discovery section reports drift between the committed registry and the pinned extraction.

## Consequences

- Flow steps into `skello-app` that cite `METHOD /path` resolve against real routes, and controller units resolve to the routes they serve.
- The monolith surface follows `routes.rb` on every `discover:apply`. Removed routes disappear.
- Gem-engine routes (ActiveStorage, ActionMailbox, StripeEvent) are outside the surface, since `routes.rb` mounts them without declaring them.
