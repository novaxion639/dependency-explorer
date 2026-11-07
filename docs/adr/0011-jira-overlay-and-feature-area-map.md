# ADR-0011: Jira overlay and Feature Area map

**Status:** accepted — 2026-11-02. Extends the snapshot → overlay path of [ADR-0010](0010-datadog-overlay-from-a-local-snapshot.md) to Jira bugs.

## Context

Product areas and teams need their open production bugs next to the architecture: how many are open, how many breached their SLA, how fast bugs arrive. Jira holds the answer, keyed by the BR project's Feature Area field, which the map does not know. [ADR-0002](0002-static-spa-no-runtime-backend.md) keeps the web app a static bundle and [ADR-0005](0005-local-poc-first.md) keeps the proof of concept on one machine.

## Decision

1. Jira follows ADR-0010's path. A fetch CLI reads Jira with the engineer's own credentials and writes raw responses to `packages/discovery/.jira-snapshots/<date>/`. `pnpm discover --jira` derives `packages/web/overlay/jira.json`, validated by `JiraOverlaySchema` in `packages/schema`. Jira is read-only: GET calls only.
2. The Feature Area map is authored and committed in `packages/data/src/feature-areas.ts`: one row per Jira Feature Area label, with its tribe and the product area it belongs to, or `null` for an unmapped one. It holds labels and areas, no bug data. `Team.jiraBoards` lists the Jira board ids of a team.
3. Bug data stays local. Snapshots and the overlay are gitignored and served in `dev` and `preview` only. A snapshot reads a bug's key, creation date, status, priority, Feature Area and SLA flag. No title, description, comment or person is read, and no bug key, title or person name enters the overlay.
4. The 🎫 drift findings (Jira against the map) are advisory. They stay out of `baseline.json` and `--fail-on-new`, since no one else can reproduce a local snapshot run.

## Consequences

- With no snapshot or no overlay, discovery and the web app behave as before; the Datadog overlay loads alone.
- Bug counts stay on the engineer's machine and out of the repository and the build output.
- Bug freshness is the snapshot's age.
- A new Feature Area in Jira shows as unmapped until a row joins the authored map.
