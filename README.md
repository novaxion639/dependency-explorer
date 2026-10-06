# Skello Dependency Explorer

The canonical, continuously verified map of Skello's distributed architecture: every service, endpoint, connection, queue and business flow, **generated from code and deployed state, enriched by humans where automation can't reach**.

It is a local proof of concept: a static bundle with no backend, run on your own machine ([ADR-0005](docs/adr/0005-local-poc-first.md)).

## What it shows

- **Product areas, microservices and the monolith:** the architecture by area, service and connection. [→ explorer](docs/guide/explorer.md)
- **48 verified flows:** swimlanes of the code each action traverses, with every call graded against the code at its pinned commit. [→ flows](docs/guide/flows.md)
- **Resources and impact:** who reads, writes, produces and consumes each table, queue and store, and what fails when one is down. [→ explorer](docs/guide/explorer.md#resource-pages), [→ data](docs/guide/data.md#resource-registry)
- **Ownership, search and permalinks:** team pages from CODEOWNERS, ⌘K over everything, and every view in the URL. [→ explorer](docs/guide/explorer.md#ownership)
- **Discovery:** a scanner that reports drift between the map and the code, the Terraform estate and live AWS. [→ discovery](docs/guide/discovery.md)

## Quickstart

```bash
pnpm install
pnpm dev        # → http://localhost:5173
```

No database, no seeding, no Docker: the dataset is imported at build time and validated on load.

## Commands

```bash
pnpm dev         # run the app locally
pnpm build       # typecheck + production build (static bundle in packages/web/dist)
pnpm typecheck   # typecheck all packages
pnpm test        # every package's test suite
pnpm check       # everything CI runs
pnpm discover    # drift report against the sibling Skello repos (more in docs/guide/discovery.md)
```

## Documentation

| Document | Covers |
|---|---|
| [docs/guide/explorer.md](docs/guide/explorer.md) | Pages, presenting, renderers, search and permalinks |
| [docs/guide/flows.md](docs/guide/flows.md) | Flow pages, the code layer and its grades, rules, flags, failure, auth and PII |
| [docs/guide/data.md](docs/guide/data.md) | Principles, packages, the endpoint surface, the resource registry, contributing |
| [docs/guide/discovery.md](docs/guide/discovery.md) | The scanner, its commands and the nightly job |
| [docs/guide/roadmap.md](docs/guide/roadmap.md) | Phases and status |
| [docs/flow-authoring-guide.md](docs/flow-authoring-guide.md) | How to author a flow |
| [docs/adr/](docs/adr/) | Architecture decisions |
