# Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Reboot: static SPA, workspace structure, integrity gates, CI | ✅ done |
| 1 | Automation-first: SDK, Rails and CODEOWNERS extractors, provenance metadata, two-layer merge, classified drift report ([ADR-0007](../adr/0007-discovery-semantics.md)) | ✅ done (nightly drift reports wait on the org read token) |
| 1.5 | More extractors: serverless configs (deploy state and static, endpoint verification), Rails routes (the monolith's inbound surface), frontend env and usage, async queue cross-reference. Layer 4 live AWS verification ships as the `aws-live` extractor (`pnpm discover -- --aws`) | ✅ done (nightly AWS automation waits on the Infra role) |
| 1.7 | AWS resource discovery. Layer 1: stream, S3 and schedule event sources and owned CloudFormation resources from serverless config. Layer 2: application-code AWS client usage. Layer 3: Terraform ground truth | ✅ done |
| 2 | Org-audience features: permalinks, global search, ownership pages, export | ✅ done (ownership coverage grows with CODEOWNERS adoption, not code) |
| 3 | "Suggest edit" → pre-filled PR through a GitHub App, with permissions from GitHub teams | |
| 4 | Live operational overlays (deploys, alarms, queue depth, on-call) through a read-only API | |

Architecture decisions are recorded in [docs/adr/](../adr/).
