# ADR-0006: Bespoke tool over a service-catalog platform

**Status:** accepted — 2026-06-09

## Context

For an org-wide, automation-first architecture catalog, the build-vs-adopt question points at Backstage (or Port/Cortex). We checked for internal overlap: the only catalog-adjacent initiative at Skello, **bugpilot**, is an AI bug-triage tool (root-cause exploration agents proposing fixes on skello-app and some microservices) — not a service catalog. No conflict.

## Decision

Stay bespoke. The differentiating value of this tool — endpoint-level connection detail, code-verified business flows with infrastructure nodes, blast radius, the flow-authoring methodology — is precisely what catalog platforms do not provide out of the box, while Backstage's strengths (plugin ecosystem, scaffolding, TechDocs) are not the goal and its operational cost is significant.

## Consequences

- We own the data model and can evolve it freely (provenance, flows, async topology).
- If Skello later adopts a catalog platform, the Zod-schema'd dataset is exportable; this decision is reversible at the data layer.
- Potential future synergy rather than competition with bugpilot: a verified dependency map with blast radius is useful context for root-cause agents.
