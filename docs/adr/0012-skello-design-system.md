# ADR-0012: Skello Design System for the web app

**Status:** accepted — 2026-11-14. Amends the "no external dependencies" posture of [ADR-0005](0005-local-poc-first.md).

## Context

The web app hand-builds every control with CSS modules over its own tokens (`styles/theme.css`), in a "Paper" look: warm paper, ink, Inter. Skello ships a React Design System, `@skelloapp/skello-ds-web`, with the brand palette, Gellix, MUI-based components and accessibility built in. It is published only to GitHub Packages, so installing it needs a token. Present mode scales type by redefining the `--text-*` custom properties, while the DS reads type from a JavaScript MUI theme.

## Decision

1. The web app adopts the Skello brand look through `@skelloapp/skello-ds-web` and drops the Paper look. Failure effects read the DS semantic palette: `error`, `warning`, `success`.
2. Installing the workspace needs a GitHub token with `read:packages` and an `.npmrc` scope line for `@skelloapp`. CI reads the package with a token that holds `read:packages` on it.
3. The DS is pinned to an exact version published at least two weeks earlier, like every other dependency.
4. `--text-*` custom properties stay authoritative for type. The DS sizes seed them on `:root`, present mode enlarges them, and the MUI typography variants the app uses read them, so DS components scale with present mode.
5. Diagram canvases (React Flow, the SVG renderer, Mermaid and image export, the sparkline) stay bespoke and read colours and type through the same custom properties.

## Consequences

- `pnpm install` fails without the token. The README install section documents the step in the change that adds the dependency.
- MUI 9 and Emotion enter the bundle as transitive dependencies of the DS. Components built on MUI X DataGrid Premium (`SkTable`, `SkDataGrid`) stay out, since they need a licence key.
- The navigation rail, the breadcrumb, the persistent detail panel and the range slider have no DS equivalent and stay bespoke, on DS tokens.
- The change that mounts the DS theme rewrites the Paper paragraph of `docs/guide/explorer.md`.
