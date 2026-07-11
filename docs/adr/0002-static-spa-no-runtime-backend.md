# ADR-0002: Static SPA, no runtime backend

**Status:** accepted — 2026-06-09

## Context

The previous iteration round-tripped a static, git-versioned dataset through MongoDB (TS files → Zod → seed script → Mongo → Express → fetch → Zod again). The database added Docker, seeding, drift risk and an unauthenticated write endpoint while providing nothing: there was no write path besides re-seeding and the Mongoose schemas used `Mixed` types, validating nothing.

## Decision

The web app imports the dataset directly at build time. The deliverable is a static bundle. No server, no database, no runtime API for the documentation core — permanently, not just for the POC (see ADR-0003 for how writes work instead).

A backend may appear later **only** as a separate, read-only overlay service for live operational data (Phase 4), joined to the static graph by service ID at render time.

## Consequences

- Zero infrastructure to run or secure; hosting is any static file server, which keeps the door open for whatever pattern the Infrastructure team approves.
- Data freshness is exactly Git freshness — which is the point: provenance and review over mutability.
- The dataset ships in the JS bundle (~10k lines of TS). Acceptable at current scale; can become a build-time JSON artifact if it grows.
