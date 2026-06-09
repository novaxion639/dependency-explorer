# ADR-0003: Git as the write path

**Status:** accepted — 2026-06-09 (implementation in Phase 3)

## Context

The audience is all of Skello engineering, so multiple people will want to correct and enrich the map. Concurrent in-app editing would force a database, sessions, conflict resolution, a permission model and an audit trail — all things Git and GitHub already provide. GitHub teams and CODEOWNERS already encode who owns which service at Skello.

## Decision

All writes — human and automated — happen through pull requests against the dataset:

- **Humans** edit the data files directly, or (Phase 3) use a "Suggest edit" button in the UI that opens a pre-filled PR via a GitHub App acting on the user's behalf. Permissions derive from GitHub teams, not a custom auth layer.
- **Automation** (Phase 1 discovery) opens nightly "architecture drift" PRs when code reality diverges from the map.

## Consequences

- Review, history, rollback, blame and an architecture changelog for free.
- Human edits and automated discovery flow through the same quality gate (CI integrity suite).
- No always-on write infrastructure to operate or secure.
