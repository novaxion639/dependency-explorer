# ADR-0010: Datadog overlay from a local snapshot

**Status:** accepted — 2026-11-02. Realises the Phase 4 overlay of [ADR-0002](0002-static-spa-no-runtime-backend.md).

## Context

ADR-0002 keeps the web app a static bundle and allows live operational data only as a separate, read-only overlay joined to the static graph by service ID at render time. Phase 4 needs that overlay for service health: monitors, SLOs, open incidents, request and error series, DLQ depth and release verdicts. [ADR-0005](0005-local-poc-first.md) keeps the proof of concept on one machine, with no hosted service.

## Decision

1. A fetch CLI (`pnpm discover:datadog:fetch`) reads Datadog with the engineer's own keys and writes raw responses to `packages/discovery/.datadog-snapshots/<date>/`. Datadog is read-only: GET calls, plus the events search POST, which is a search.
2. `pnpm discover --datadog` derives the overlay `packages/web/overlay/datadog.json`, validated by `DatadogOverlaySchema` in `packages/schema`.
3. The web app fetches the overlay at runtime and joins it to the map by service `name`, resource id for queues. The overlay never adds or changes a service, connection or resource.
4. Snapshots and the overlay are gitignored. The overlay sits outside `packages/web/public`, so `vite build` never copies it; a Vite plugin serves it in `dev` and `preview` only.
5. Logs are out: no log lines, incident bodies, monitor messages or monitor queries enter a snapshot or the overlay.
6. The 🐶 drift findings (Datadog against the map) are advisory. They stay out of `baseline.json` and `--fail-on-new`, since their keys carry operational names and no one else can reproduce a local snapshot run.

## Consequences

- A hosted, read-only overlay API replaces the file by changing one URL; the schema, the join and the UI stay as they are.
- With no snapshot or no overlay, discovery and the web app behave as before.
- Health data stays on the engineer's machine and out of the repository and the build output.
- Health freshness is the snapshot's age. The UI marks a snapshot older than 7 days as stale.
