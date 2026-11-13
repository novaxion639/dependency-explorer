# Dependency Explorer

The canonical map of Skello's distributed architecture, generated from code and deployed state: services, connections, resources and verified flows. A pnpm workspace of four packages: `schema`, `data`, `discovery`, `web`.

See [README.md](README.md) for the product and `docs/guide/` for the guides.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Serves the web app |
| `pnpm check` | Typecheck, lint, unused exports, tests, build; the gate before every push |
| `pnpm typecheck`, `pnpm lint`, `pnpm check:exports`, `pnpm test`, `pnpm build` | The five parts of `pnpm check` |
| `pnpm lint` | ESLint on `web` and `schema`: no type assertion, no non-null assertion, braced bodies, hook rules, jsx-a11y |
| `pnpm check:exports` | Fails on an unused file, export or type (knip) |
| `pnpm preview` | Serves the built bundle |
| `pnpm discover` | Runs discovery and prints the report |
| `pnpm discover:apply` | Runs discovery at the pinned commits and writes the generated datasets |
| `pnpm discover:baseline` | Runs discovery at the pinned commits and writes `baseline.json` |
| `pnpm discover:aws:fetch` | Fetches the AWS live-verification snapshot |
| `pnpm discover:datadog:fetch` | Fetches the Datadog snapshot (`DATADOG_API_KEY`, `DATADOG_APP_KEY`) |
| `pnpm discover -- --datadog` | Adds the 🐶 section and writes the web overlay from the latest snapshot |
| `pnpm discover:jira:fetch` | Fetches the Jira snapshot (`JIRA_EMAIL`, `JIRA_API_TOKEN`) |
| `pnpm discover:jira:draft` | Drafts `feature-areas.ts` rows from the latest Jira snapshot |
| `pnpm discover -- --jira` | Adds the 🎫 section and writes the Jira web overlay from the latest snapshot |
| `pnpm discover -- --delivery` | Adds the 🚚 section and writes the delivery web overlay from the clones' branches |
| `pnpm --filter @dependency-explorer/discovery golden:update` | Rewrites the golden files after an intended output change |
| `pnpm discover:scaffold` | Scaffolds a flow from a trace |
| `pnpm discover:trace` | Traces a call path |
| `pnpm docs:gen` | Regenerates the generated docs |

## Hard rules

Dataset doctrine:

- Verify a literal exists in source before authoring a ref to it; where it does not verify, use a waiver, a tokenType-only ref or prose, never a fabricated ref.
- Every checker ships with a negative control: fabricate one wrong value, watch the section go red with an actionable remediation, restore.
- Report sections print the fix: the re-stamp hash, the real DLQ or authorizer candidates.
- Absence is representable (`dlqAbsent`, `authAbsent`), so a genuine gap never forces a fabrication or a permanent red.

Tooling:

- Workflow tool `args` arrive JSON-stringified at the script runtime; embed per-run data in the script body.
- A multi-file `grep` through the rtk hook can silently return zero matches; sweep with `rtk proxy grep` on a single target, or Python.
- After the first `git push -u`, `git rev-parse --abbrev-ref @{u}` shows the upstream; set it with `git branch --set-upstream-to` when missing.
- Never `git checkout <file>` to revert a demo mutation on a file carrying uncommitted work; mutate and restore with targeted string swaps.

Repository:

- Dependencies carry exact versions, never `^` or `~`; a new dependency takes a version published at least two weeks earlier.
- Discovery runs from the main clone, where the sibling repos are available.
- Never commit `.aws-snapshots/`, `.datadog-snapshots/`, `.jira-snapshots/` or `packages/web/overlay/`.
- `tasks/lessons.md` is the log these rules come from.

## Documentation sync

| Code path | Doc to update |
|---|---|
| `packages/schema/src/*` | `docs/guide/data.md` |
| `packages/discovery/src/extractors/*`, a report section of `discover.ts` | `docs/guide/discovery.md` |
| `packages/web/src/shell/*`, a page, `packages/web/src/components/health/*` | `docs/guide/explorer.md` |
| `packages/discovery/src/datadog/*`, `datadog-fetch.ts`, `golden.test.ts`, `test-support/*` | `docs/guide/discovery.md` |
| `packages/discovery/src/jira/*`, `jira-fetch.ts`, `jira-draft.ts` | `docs/guide/discovery.md` |
| `packages/discovery/src/delivery/*` | `docs/guide/discovery.md` |
| `packages/web/src/components/delivery/*` | `docs/guide/explorer.md` |
| `packages/data/src/feature-areas.ts`, `jiraBoards` in `teams.ts` | `docs/guide/data.md` |
| `packages/data/src/flows/*`, flow rules | `docs/guide/flows.md`, `docs/flow-authoring-guide.md` |
| A roadmap phase starting or ending | `docs/guide/roadmap.md` |
| A decision that shapes the repo | a record in `docs/adr/` |
