# ADR-0008: Product areas as the business taxonomy

**Status:** accepted — 2026-10-01

## Context

The map's business taxonomy is the set of product areas a Skello user navigates: Planning, Time & attendance, Leave & requests and eleven more, taken from the web navbar and settings, the mobile tabs, the tablet screens and the monolith's `v3/api` namespaces. Platforms — backend, monolith, web, mobile, tablet, superadmin — are an orthogonal axis: each platform implements a subset of the areas. The monolith, the web front and the mobile apps host most areas at once.

## Decision

1. A product area owns **code locations** (repo + platform + globs) and **flows**, never whole hosts.
2. A flow's areas are **derived** from its code-unit paths matched against the globs; each flow declares one authored `primaryArea` among them.
3. Cross-cutting capabilities (auth, notifications, search, feature flags, BFFs, assistant) are areas of `kind: 'platform'`, rendered apart from product areas. A flow whose code lives only in a capability takes it as primary area.
4. Owners, definitions, reading-path order and their rationale are human-owned. Globs, glossary anchors and external-system evidence are facts verified by the 🗺 discovery section.

## Consequences

- "Where does Planning live?" has a verified answer across every platform.
- Monolith coverage — the share of `app/` files mapped to an area — is measurable and drives the adoption backlog.
- The path-matching helper is the same piece the change-impact work reuses for file → area → flows.
