# Discovery

`packages/discovery` scans the sibling Skello repos and reports drift between the dataset and the code ([ADR-0007](../adr/0007-discovery-semantics.md)).

## What it reads

- **Code and config:**
  - SDK usage;
  - serverless config: HTTP, SQS, Kinesis/DynamoDB streams, S3 triggers, EventBridge schedules;
  - serverless event sources and owned CloudFormation resources (🌀 report section), which feed the `RecurringTask` model and the CDC backbone edges;
  - Rails clients and routes;
  - frontend env usage.
- **Application-code AWS clients** (🔧 report section):
  - Kinesis/Firehose produce, S3 reads and writes, DynamoDB CRUD and TypeORM Postgres coupling;
  - each compared with `service.databases`, in both directions.
- **Terraform ground truth** (the `<service>-tf` checkouts; 🏗 report section):
  - owned resources and `terraform-aws-modules` stores;
  - DMS replication tasks, which prove the aurora → kinesis CDC backbone, and the streams they feed;
  - MongoDB Atlas user roles and IAM actions.
- **Table listeners** (👂 report section):
  - callbacks, concern bodies included, with `if:` / `unless:` kept as source text;
  - `dependent:` cascades, `touch: true` and gem hooks: `acts_as_list`, `has_ancestry` and geocoder's `geocode` / `reverse_geocode`, provided by `geocoded_by` / `reverse_geocoded_by`;
  - `has_and_belongs_to_many` destroys its join table, and `has_ancestry` descendants are destroyed by default, or re-parented under `orphan_strategy:` `:adopt` / `:rootify`;
  - the jobs callbacks enqueue and the callee one call level below them, so `Shift` → `ShiftCallbackJob` → `WeeklyOption.upsert_employee_change!` reaches `weekly_options`;
  - write sites classified by the listeners they run, each statement read whole (multi-line chains and the call's own arguments); raw SQL `INSERT`, `UPDATE` and `DELETE` run none, and `run_callbacks(:phase)` fires that phase's listeners;
  - the CDC feed: the CDC task replicating each table to its stream, and the per-table stream consumers whose `filterPatterns` name the table's prefix.
- **Product-area code locations:**
  - glob liveness;
  - monolith, front and mobile coverage;
  - glossary anchors;
  - external-system evidence.
- **Flow verification** at the pinned commit:
  - unit paths and call-edge grades (see [flows.md](flows.md#the-code-layer-and-its-grades));
  - branch literals, domain-rule stamps, flags, DLQs, auth refs and PII refs;
  - ⚙ state machines: each authored machine against its Step Functions definition — states, types, transitions, catches, concurrency, task handler files, and states in code the flow does not declare (see [flows.md](flows.md#state-machines)).
- **Live AWS state** (Layer 4), compared with the map: a read-only account snapshot of event source mappings, subscriptions and filter policies, DMS tasks, bucket notifications and schedules.
  - Snapshots are gitignored.
  - Sandbox account only, per the credentials story (`research/aws-live-verification-credentials.md` in the shared docs).

## Commands

```bash
pnpm discover                 # scan sibling Skello repos → classified drift report
pnpm discover -- --pinned     # same, against each repo's production branch (master; main for *-tf) as detached worktrees in .pinned/
pnpm discover:apply           # pinned run + regenerate the discovered overlay (provenance stamps, call-edge grades), the monolith routes and listeners.json; refuses to run unpinned
pnpm discover:baseline        # pinned run + rewrite packages/discovery/baseline.json (accepted findings and scanned repo set)
pnpm discover -- --pinned --fail-on-new   # exit 1 when a finding is not in the baseline, or a baseline repo was not scanned
pnpm --filter @dependency-explorer/discovery discover:unit-paths   # exit 1 when a flow unit's file is missing at its pinned commit; counts units it skips (repo not cloned or not pinned)
pnpm --filter @dependency-explorer/discovery discover:grades       # replay call-edge grades against the existing pinned worktrees, no re-pin
pnpm --filter @dependency-explorer/discovery discover:machines     # check flow state machines against the pinned definitions (⚙), no re-pin
pnpm --filter @dependency-explorer/discovery discover:listeners   # listeners at the pinned skello-app, counts for the busiest tables, 👂 findings
pnpm discover -- --aws [dir]  # + 🛰 live AWS snapshot diff (defaults to the latest snapshot)
pnpm discover:aws:fetch --profile skl-sandbox   # capture a read-only snapshot (~215 calls, MFA'd session required)
pnpm docs:gen                 # rewrite the generated sections of the inventory docs (CI fails on drift)
```

## Listener drift (👂)

The 👂 section checks the table listener surface at the pinned commit. A skello-app that is not pinned is skipped. Findings carry a kind, a subject and a detail; accepted findings enter `packages/discovery/baseline.json` through `pnpm discover:baseline`.

| Kind | Meaning |
|---|---|
| `surface-drift` | listeners, write sites or CDC relations at the pin differ from the committed `listeners.json` / `resources.json`: `discover:apply` is due |
| `unresolved-callback` | a callback symbol with no `def` in the model or its included modules |
| `unresolved-job` | an enqueued constant with no file under `app/jobs/` |
| `unknown-gem-macro` | a class macro outside Rails associations and `KNOWN_GEM_LISTENERS` |
| `cdc-unknown-table` | a CDC selection rule naming a table absent from `db/schema.rb`; `ar_internal_metadata`, `schema_migrations` and `pg_stat_statements` are exempt |
| `flow-listener-missing` | a listener a flow fires that its `model-callback` units do not draw |
| `flow-listener-unsupported` | a drawn `model-callback` edge that no fired listener backs |

At `3f6728f`, `cdc-unknown-table` reports `audits`, `organisation_monthly_stats`, `shop_holiday_settings` and `user_holiday_settings`.

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
