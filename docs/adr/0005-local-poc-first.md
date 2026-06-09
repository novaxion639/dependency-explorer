# ADR-0005: Local POC first, hosting deferred

**Status:** accepted — 2026-06-09

## Context

Deploying applications on the Skello network is owned by the Infrastructure team and the Architects. Their review and approval is required before this tool gets a hosted home, an SSO integration or network permissions. Blocking the project on that discussion would be wasteful; ignoring it would be rude.

## Decision

Phase 0–1 run entirely locally (`pnpm dev`), with zero deployment assumptions baked in. Everything that would be hosting-specific is kept out of the application:

- Output is a static bundle (ADR-0002) servable by any pattern the supervising teams choose (S3+CloudFront, ALB+OIDC, behind VPN, internal tooling host…).
- Authentication is explicitly **not** implemented in-app; it is expected to be provided by the hosting layer (SSO proxy / IdP) when that exists.
- CI builds the artifact on every merge so a deploy step can be appended later without restructuring.

## Consequences

- The hosting conversation with Infra/Architects can happen on the basis of a working, demonstrable tool.
- Nothing in the codebase will need to change to adopt their chosen pattern — only a deploy step and possibly a Terraform module elsewhere.
