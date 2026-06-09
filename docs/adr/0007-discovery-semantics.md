# ADR-0007: Discovery semantics — classify, never guess

**Status:** accepted — 2026-06-09

## Context

Phase 1 implements the discovered layer (ADR-0004). Two early findings shaped the rules below: SDK presence does not prove runtime calls (svc-bff-planning imports the auto-scheduling SDK for types only), and CODEOWNERS frequency does not encode service ownership (squad-infra appears in every repo because it owns the `/aws/` config files — the first scan briefly assigned every service to one squad before this was caught).

## Decision

1. **Evidence, not truth.** Discovery verifies *existing* dataset entries and stamps them with provenance (`lastVerified`, `evidence`). It never adds, removes or rewrites entities on its own — new findings are report sections for human adoption through PRs.
2. **Classify everything; guess nothing.** Every SDK/client mapping lives in an explicit table (`mapping.ts`): overrides for non-conventional names, an ignore list for shared libraries, `null` for ambiguous Rails clients. Anything unmapped is *reported*, never inferred.
3. **Ownership only via curated mapping.** `teamId` is assigned solely through `teams.githubTeams`; unmapped CODEOWNERS slugs are reported. The real org slugs (team-salsa, team-pesto, team-roquefort, squad-data, squad-front…) must be reconciled with the team list before mappings are added.
4. **Honest verdicts.** The report distinguishes ✅ verified / 🆕 candidate / ⚠️ stale (repo present, no evidence) / ⏭ unverifiable (repo absent, frontend HTTP, non-npm declaration) — "no evidence" and "cannot check" are different claims.
5. **Local-first.** Discovery scans sibling checkouts under `Skello_Dev/`. CI-scheduled runs (nightly drift PRs) require an org-read token / GitHub App — provisioning belongs to the same Infra/Architects discussion as hosting (ADR-0005). Until then `pnpm discover` is run by humans and the overlay is committed like any other change, gated by the integrity suite.

## Consequences

- The overlay (`packages/data/src/generated/discovered.json`) is regenerable at will and safe by construction (integrity tests reject stamps on unknown entities).
- Coverage grows by extending mapping tables and extractors (Rails routes dump, serverless configs, AWS read-only, frontend HTTP calls) — each addition widens the verified set without touching the manual layer.
