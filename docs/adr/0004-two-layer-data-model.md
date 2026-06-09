# ADR-0004: Two-layer data model — discovered facts vs authored knowledge

**Status:** accepted — 2026-06-09 (implementation in Phase 1)

## Context

The dataset's existential risk is drift: it is only valuable while engineers trust it. Today everything is hand-authored, including facts a machine can verify (SDK dependencies, endpoints, repo URLs, team ownership). Hand-maintaining machine-checkable facts guarantees decay; regenerating everything mechanically would clobber the researched flow narratives and domain knowledge that make the map valuable.

## Decision

Split the dataset into two layers, merged at build time:

- **Discovered layer** (generated): connections, endpoints, infra resources, repo URLs, team ownership — produced by extractors (serverless configs, Rails routes dumps, package.json SDK deps, CODEOWNERS, AWS read-only queries).
- **Manual layer** (authored): flows, domains, descriptions, business context — following `docs/flow-authoring-guide.md`.

Every entity carries provenance metadata: `source` (discovered | manual), `lastVerified`. The UI surfaces freshness. Conflicts between the layers fail CI as drift.

## Consequences

- Regeneration is always safe; human knowledge is never overwritten.
- "When was this last true?" has an answer for every node and edge.
- Schema work required in Phase 1: provenance fields, explicit `communicationType`/`protocol`/`authType` (replacing inference from `sdkPackage` strings), queue/topic intermediaries as first-class async connection elements.
