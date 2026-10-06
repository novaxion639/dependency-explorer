# Discovery

`packages/discovery` scans the sibling Skello repos and reports drift between the dataset and the code ([ADR-0007](../adr/0007-discovery-semantics.md)).

## What it reads

- **Code and config:**
  - SDK usage;
  - serverless config: HTTP, SQS, Kinesis/DynamoDB streams, S3 triggers, EventBridge schedules;
  - Rails clients and routes;
  - frontend env usage.
- **Application-code AWS clients:**
  - Kinesis/Firehose produce, S3 reads and writes, DynamoDB CRUD and TypeORM Postgres coupling;
  - each compared with `service.databases`, in both directions.
- **Terraform ground truth** (the `<service>-tf` checkouts):
  - owned resources and `terraform-aws-modules` stores;
  - DMS replication tasks and the streams they feed;
  - MongoDB Atlas user roles and IAM actions.
- **Product-area code locations:**
  - glob liveness;
  - monolith, front and mobile coverage;
  - glossary anchors;
  - external-system evidence.
- **Flow verification** at the pinned commit:
  - unit paths and call-edge grades (see [flows.md](flows.md#the-code-layer-and-its-grades));
  - branch literals, domain-rule stamps, flags, DLQs, auth refs and PII refs.
- **Live AWS state** (Layer 4), compared with the map: a read-only account snapshot of event source mappings, subscriptions and filter policies, DMS tasks, bucket notifications and schedules.
  - Snapshots are gitignored.
  - Sandbox account only, per the credentials story in the shared docs.

## Commands

```bash
pnpm discover                 # scan sibling Skello repos → classified drift report
pnpm discover -- --pinned     # same, against each repo's production branch (master; main for *-tf) as detached worktrees in .pinned/
pnpm discover:apply           # pinned run + regenerate the discovered overlay (provenance stamps, call-edge grades) and the monolith routes; refuses to run unpinned
pnpm discover:baseline        # pinned run + rewrite packages/discovery/baseline.json (accepted findings and scanned repo set)
pnpm discover -- --pinned --fail-on-new   # exit 1 when a finding is not in the baseline, or a baseline repo was not scanned
pnpm --filter @dependency-explorer/discovery discover:unit-paths   # exit 1 when a flow unit's file is missing at its pinned commit; counts units it skips
pnpm --filter @dependency-explorer/discovery discover:grades       # replay call-edge grades against the existing pinned worktrees, no re-pin
pnpm discover -- --aws [dir]  # + 🛰 live AWS snapshot diff (defaults to the latest snapshot)
pnpm discover:aws:fetch --profile skl-sandbox   # capture a read-only snapshot (~215 calls, MFA'd session required)
pnpm docs:gen                 # rewrite the generated sections of the inventory docs (CI fails on drift)
```

## Nightly discovery

`.github/workflows/discovery-nightly.yml` runs every night at 03:00 UTC, and on manual dispatch.

**What it runs:**
1. It clones every repo that `pnpm --filter @dependency-explorer/discovery repo-list` prints: the baseline's scanned set, plus every dataset service and its `-tf` repo.
2. Each repo is cloned at its production branch, using the `DISCOVERY_READ_TOKEN` repository secret (org read access).
3. It then runs `pnpm discover -- --pinned --fail-on-new`.

**Output:** the report is the job summary and the `discovery-report` artifact. The job opens no pull requests.

**When it fails:**
- **A new finding:** a finding missing from `packages/discovery/baseline.json` turns the job red.
- **A missing repo:** so does a repo from the baseline's scanned set that was not pinned, since its findings would otherwise read as resolved.
- **No secret:** without `DISCOVERY_READ_TOKEN`, the job fails at its first step with `secret DISCOVERY_READ_TOKEN not configured`.

Accepting drift is a reviewed commit of `pnpm discover:baseline`.
