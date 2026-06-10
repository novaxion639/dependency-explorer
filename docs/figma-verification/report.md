# FigJam ↔ Dependency Map Verification Report

> Branch: `verify/figjam-diagrams` · Method: docs/figma-architecture-index.md §methodology
> Classification: ✅ diagram agrees with map · 🆕 diagram-only claim · ⚠ map-only claim · ❓ ambiguous
> Diagram-sourced corrections enter the dataset as `provenance.source: manual` with the board URL
> as evidence; code evidence outranks diagrams (ADR-0007).

## SvcReports — [SvcReports Architecture](https://www.figma.com/board/QMqV3xwxK9ELqQPjaWGEVJ) (Active v1.0)

- ✅ Endpoint surface: PAM-config / variable-pay-elements-custom / payroll-software CRUD ×5 each → DynamoDB — matches the scaffolded endpoints exactly.
- ✅ Callers: superadmin, skello-app-front ("user of report"), skello-app (ECS) — all three connections in map, verified.
- 🆕 DMS Full-Load/CDC pipeline: `skelloapp` RDS → `skelloapp-bus` → svc-reports DynamoDB (filter `pk=public.*`, Lambda JobFullLoadAndCdc + DLQ) — **CDC ingestion edge not modelled** (schema currently allows one connection per from→to pair; skello-app→svc-reports already holds the REST edge → recorded as description enrichment candidate + schema-evolution item: multi-transport edges).
- 🆕 Data-platform export: JobToData (filter `type=PAM_CONFIG`) → Firehose → S3 RawData (AWS DATA account) — out-of-map account, candidate infra note.
- 📌 Sticky (Archi Skello): "Warning DMS to DynamoDB creates a new DynamoDB for the errors".
- ⚠ Board is linked from the **svc-payroll** README (link drift on the repo side).

## SvcCommunicationsV2 — [v2 AWS SES](https://www.figma.com/board/0g8amcIfVZFI1Y8PoOaYES) (2025-08)

- ✅ **Ingestion model confirmed by the architects' own drawing**: API section (Route53 → ACM `svc-communications-v2.skello.io` → API Gateway + Lambda authorizer) connects **directly to the EmailHighPriority and EmailLowPriority SQS queues** — exactly the API GW → SQS-SendMessage architecture we verified in code and encoded as async/rest.
- ✅ Email pipeline internals consistent with the service description: queues → EmailProcess Lambda (batchSize 25) → DynamoDB `SvcCommunicationsV2`; DynamoDB stream (`type=EMAIL AND status=EMAIL_CREATED`) → TriggerSendEmailToSqsStream → provider trigger queues; retry lambda; webhook return paths (Brevo webhook queue; **SES webhook via SNS → SQS → Lambda**).
- ✅ Blacklist management: AddBlacklistEmail auto-trigger ("if emailStatus is considered as to blacklist") + RemoveBlacklistEmail via `HTTP DELETE /blacklisted/{email}` annotated "JWT: is super admin?" — matches the blacklist endpoints and superadmin's admin usage.
- ✅ ApiEmailDisplay Lambda → S3 `emails` (getObject) + DynamoDB — matches `api-email-display` / SDK `getEmailDisplay`.
- ✅ comms→svc-events confirmed *with mechanism*: `triggerSvcEventsEmailsStream` Lambda (DynamoDB stream on Email entity create/status-update) → SvcEvents — our verified connection, now with the how.
- 🆕 **External e-mail providers drawn as dual path**: legacy **Brevo** (EmailTriggerBrevo queue+Lambda, putObject `{emailId}.html` → S3) and newer **AWS SES** (EmailTriggerAWSSES queue+Lambda, SNS webhook return). External SaaS dependencies aren't modelled in the schema — candidate for service-description enrichment (done) / future `externalDependencies` field.
- 🆕 **Mobile (React) drawn as an SDK consumer** — skello-mobile isn't in the map at all (schema has `react-native` type ready). Candidate service + connection.
- 🆕 S3 buckets `emails` + `attachments` and AWS AppConfig (feature flags for the send path) — candidates for the service's databases/infra list.
- 🆕 Same ToData → Firehose → S3 RawData (AWS DATA) export pattern as svc-reports — the data-platform export is clearly a per-service convention.

## SvcDocumentsEsignature — [[Architecture] SvcDocumentsEsignature (no-edit)](https://www.figma.com/board/qkHSpStgTsttF5zpGk90B0) (2025-09)

- ✅ All four map endpoints exist on the board as API Gateway → Lambda routes (snake_case on the board vs kebab-case in the map): "POST /documents_status" → Lambda DocumentsStatus, "POST /document_signature_reminder" → Lambda DocumentSignatureReminder, "GET /document_signable" → Lambda DocumentSignable, "POST /attendance_sheet_signature_reminder" → Lambda AttendanceSheetSignatureReminder. No fifth public route — endpoint inventory matches exactly.
- ✅ skello-app → esignature edge confirmed: SkelloApp section (EC2) → Api section, connector labeled "svc-documents-esignature.skello.io" (Route 53 + ACM + "ApiGateway API" front the service).
- ✅ DynamoDB confirmed: "DynamoDB svcDocuments-eSignature"; written by CreateEsignatureRecord/UpdateEsignatureRecord, read by DocumentsStatus and DocumentSignatureReminder.
- ✅ esignature → documents-service edge confirmed in direction and protocol: Lambda DocumentSignable → SvcDocuments, connector "https://svc-documents.skello.io:443", tied to GET /document_signable.
- ✅ Yousign shown fully behind THIS service — 10 Lambdas connect outbound to yousign.com. This is the 2025-09 pre-migration world: the board neither contradicts nor reflects the decommission assessment; it is the architecture being displaced.
- 🆕 Async write path absent from map: SkelloApp (puma) → SQS "skelloApp-puma-eSignature" → CreateEsignatureRecord → StepFunctions SignatureRequest (full SFN flow drawn: upload → create [ordered/unordered signers branch] → activate → timeout?→cancel → download; "VPC").
- 🆕 Inbound Yousign webhook absent from map: yousign.com → second API Gateway (px3h5k1v0c.execute-api…) → "/prod/webhooks//document_signed" → SQS yousignWebhook → Lambda → Step Function.
- 🆕 Worker fleet: 8 SFN workers each with dedicated SQS ("Retry : 3") + 7 named DLQs; KMS envelope encryption on upload/download; DynamoDB → SendDataToFirehose → Firehose → S3 toData (AWS DATA) analytics export (same convention as reports/comms).
- ⚠ S3 bucket conflict: board reads/writes "S3 svc-documents"; map claims `svc-esignature.{env}` — one is wrong or the bucket is shared with svc-documents.
- ⚠ Map's single "svc-esignature-dlq" doesn't exist on the board (seven specific DLQs instead) — lossy summary in the map.
- ⚠ Map edges svc-intelligence→esignature and skello-app-front→esignature absent from the board (both target /documents_status which the board exposes — plausibly missing-from-diagram, our code evidence stands).
- ⚠ Hostname: board's Route53/ACM read "svc-documents-esignature.skello.io" — contradicts our note that the host uses the short name (the front env var points at svc-esignature.sandbox; possibly env-specific aliases).
- ⚠ Board says Status "Active" v1.0 (2025-09) — predates the staleness signals behind our decommission-watch tag; carries no decommission marker.
- ⚠ Map's esignature→svc-documents-v2 usedEndpoints ("api-bulk-send-signature-reminders") unverifiable from the board and looks suspect (known merge-era artifact class).
- ❓ Unlabeled connector yousign.com → main API (duplicate/legacy arrow?); two API sections with one custom domain; mixed queue arrow conventions; duplicated SFN box labels (board copy-paste slips).

## SvcAutomaticScheduling — [[Architecture] SvcAutomaticScheduling](https://www.figma.com/board/V0FSCIKRraE4l48xaMp5bO) (2026-03)

- ✅ SFN pipeline 1:1 with our code-verified flow: sfnFetchData → sfnComputeEligibility → sfnAgregateAndBuildPayload → sfnOptimizer → sfnBuildResponseAndSendMetrics (+ sfnHandleFailure off-chain) = dataFetcher → eligibility → aggregate → solver → finishJob (+ errorHandler).
- ✅ Trigger: ComputeAutoScheduling —"SELECT existing job INSERT new Job record"→ AutoSchedulingJobs Collection (VPC MongoDB) — matches our MongoDB job store; ✅ replacement path (ComputeSuggestions → Shifts Collection + SkelloApp + metrics SQS); ✅ metrics → data-platform chain; ✅ WebSocket edge to "websocket-genericMessage" in the Websocket section; ✅ JWT authorizer; ✅ MongoDB-not-DynamoDB job store.
- 🆕 Public-edge stack (ApiGateway, AuthorizerJWT, ACM+Route53 custom domain); 🆕 idempotency "SELECT existing job" check; 🆕 gallery of embedded sibling boards (only Websocket/SkelloApp/DataPlatform actually wired).
- ⚠ Board lacks assignShifts (6 SFN Lambdas vs our verified 7 — no SFN→SkelloApp write-back drawn); ⚠ no dataFetcher ingress edges (skello-app GETs + svc-search Mongo reads not drawn); ⚠ svc-workload-plan edge missing (embed present, unwired); ⚠ "DELETE Job record" vs our verified status=FINISHED update + per-step statuses; ⚠ one merged metrics queue vs our two (autoAssignMetrics / shiftsEmployeeReplacementsMetrics); ⚠ routes drawn as "POST /auto_scheduling" and "POST /shifts-replacement/suggestions" vs deployed POST /automatic_assignment/compute and GET /shifts/{shiftId}/employee_replacements; cancel/generate/position-config endpoints absent; ⚠ "Shifts Collection" drawn inside the service's own cluster with no svc-search attribution.
- ❓ S3 "InputData" fed by the SFN — see Automatic Shift Creation board: that bucket belongs to the *generation* pipeline (resolves our service-file-vs-flow S3 ambiguity). ❓ Lambda count 10 vs description's 13. ❓ Template remnants on the board (icon palettes) — not service claims.
- 📌 DATASET BUG EXPOSED: flow says `websocket-genericMessage`, connections say `websocket-topicMessage` — code (websockets serverless config) says **topicMessage** → flow text fixed in this branch.

## Automatic Shift Creation — [board](https://www.figma.com/board/kxGcezpaSywlVvCNIPj7b3) (2026-04)

- 📌 Scope: this is the **unassigned-shift GENERATION pipeline** (api-generate-unassigned-shifts + position-configs endpoints) — a second state machine, sibling to the assignment SFN; its absence of compute/solver steps is expected, not drift.
- ✅ svc-workload-plan "GET /v2/workload-plans — 2. Fetch needs" (exact match to our adopted edge + endpoint); ✅ svc-search "3. MongoDB" direct VPC reads; ✅ svc-websocket-v2 "Topic-based pub/sub / SQS relay / 5. SQS broadcast / 6. WebSocket real-time" — confirms the corrected async topology and the topicMessage naming.
- 🆕 Full SFN drawn, unmapped: Parallel FetchData (workload plans / existing shifts / shop info / position configs) → ComputeShifts ("ALGO PUR + S3 write (1GB)") → Distributed Map (MaxConcurrency=3, Batch=200) → CreateShiftsBatch → AggregateResults → NotifyResult; 🆕 Kinesis `skelloapp-bus` consumer ("Position events" / "Position delete") — no Kinesis edge in map; 🆕 S3 (7d TTL) context bucket — resolves which pipeline owns `svc-automatic-scheduling-sfn-ctx`.
- ⚠ skello-app "4. POST /shifts (bulk)" — bulk shift-creation endpoint not in our map's skello-app edge roles (verify in code, then add); ⚠ board's "MongoDB: shifts + shops" — collections are shifts + rawPoste, shop info comes from skello-app; ⚠ trigger label "/generate" shorthand vs deployed /v1/auto_scheduling/generate_unassigned_shifts; ⚠ NotifyResult "status: completed" matches no known job-status vocabulary.
- ❓ svc-labour-laws "CC defaults" near the frontend — front→labour-laws exists; a direct scheduling→labour-laws edge would be new and is unverified.
- ✅ Freshness verdict: consistent with all April corrections wherever it overlaps them.

## SvcEmployees — [[Architecture] SvcEmployees (no-edit)](https://www.figma.com/board/smHZQHI4VqPCGYrnML4xim) (2026-01)

- ✅ DynamoDB "SvcEmployees" as the ONLY service-owned store (all Api*/Pull* Lambdas read/write it); ✅ the five bulk-config SQS queue pairs match serverless config (each with its own DLQ — the map's single generic dlq is a lossy summary); ✅ 13 routes match exactly (Route53+ACM svc-employees.skello.io → API GW).
- ⚠ **employee-hris-sync flow contradicted**: no svc-employees PostgreSQL exists; the only RDS is the monolith's, CDC'd into Kinesis "SkelloAppBus" (`public.users|shops|user_extended_info|contract|*`) **consumed by** svc-employees' KinesisFortifyEventUpdateJob → flow infra fixed in this branch (pg-employees/cdc-employees → dynamo + skelloapp-bus consumption).
- ⚠ Map's mongodb "svc-employees (legacy store)" — board's only Mongo is **SvcSearch's collection `contract`**, read directly by ApiGetActiveContracts (VPC pattern again); ⚠ map's kinesis "svc-employees-stream" has no counterpart (outbound is the standard Firehose ToData → S3 RawData analytics export); ⚠ two path mismatches (compute-annualization, active-contracts).
- 🆕 **Fortify (Silae payroll) integration entirely unmapped**: inbound POST /v1/fortify/employees = API GW **direct-SQS integration** → UpdateEmployeeSQS → PullUpdateEmployeeJob; outbound KinesisFortifyEventUpdateJob pushes to https://fortify.silae.fr + retry DLQ. Sticky: "FORTIFY DOES NOT MANAGE UNICITY KEYS".
- 🆕 **Reverse facade calls into the monolith missing from map**: ApiGetEmployee → SkelloApp GET /private/employees/employees; PullUpdateEmployeeJob → PATCH /private/employees/employees — svc-employees→skello-app edge candidate (GET /v1/employees is a facade over monolith private endpoints).
- ❓ None of the 8 map callers drawn (generic sdk box only); map callees (events, comms, users) not drawn; ~11 newer map endpoints absent (board predates them — v1.0, 2026-01).

## svcHris — [Architecture](https://www.figma.com/board/KCi31pS2Zj0SRQCU06rfXM) (2025-11)

- ❓ **Board is cover-only** — one thumbnail frame ("SvcHris / Architecture / Active / Version 1.0 / GITHUB"), zero shapes, zero connectors. A scaffold whose diagram was never drawn; mark non-authoritative.
- ❓ No provider drawn (map knows **Kombo** from endpoints incl. POST /webhook/kombo); sync direction not depicted (map's pull-direction stands on code evidence).
- ⚠ DATASET INCONSISTENCY FLAGGED: service def says dynamodb `svcHris-{env}` + s3 + dlq; the employee-hris-sync flow invented mongodb "hris-mirror" → flow infra fixed in this branch (aligned to dynamodb).

## svcKpisV2 — [svcKpisV2](https://www.figma.com/board/9O0b2K9XSKU3jx7vxkAZZc) (2026-02)

- ✅ Storage = MongoDB ("Collection SvcKpisV2 — kpisManual, settingActivityPrediction, settingsDisplayMetrics" in VPC MongoDB) — matches the service entry; ✅ AuthorizerJWT matches edge authTypes; ✅ activity-prediction GET/PUT pair (📌 path spelling: board plural /settings/, map singular /setting/).
- ⚠ **Both flows contradicted**: pg-kpis / pg-kpis-workload "kpis-db" PostgreSQL doesn't exist (only RDS drawn is the monolith's, as a DMS source for a one-off weekly_options full-load Kinesis) → flow infra fixed in this branch (→ MongoDB); ⚠ kinesis-kpis "consume" edge wrong: the realtime stream is **EventBridge**, *produced* by svc-kpis-v2 (filters → ToData / ToWS) → node removed from bff-dashboard flow.
- ⚠ svc-kpis-v2→svc-pos REST edge contradicted by the board: POS data arrives via svc-pos jobs upserting into **SvcSearch's Mongo collections** (svcpos-transaction/forecast) which ReadAllKpis queries; plus SNS→SQS settings path. Same for svc-kpis-v2→svc-employees (contract data read from SvcSearch collections). Our SDK value-import evidence still stands — needs code-level reconciliation (the SDK edges may be narrower than described).
- ⚠ svc-kpis-v2→svc-search "indexes KPI snapshots" — board shows the reverse (reads collections over VPC); description suspect.
- 🆕 svc-kpis-v2 → websockets ("ToWS" via EventBridge) edge unmapped; 🆕 board-only display-metrics endpoints (marked "next step" — in flux per working stickies); 🆕 the SDK also fronts legacy **svc-kpis v1** (unmapped service); 🆕 MergeShop SNS→SQS→Job path (the shop-merge fan-out we hypothesized during queue cross-ref!).
- ❓ POST /kpis drawn as "PUT /{kpis}" async via API GW→SQS UpsertKpis; reference-week + kpis-manual/_bulk endpoints not drawn.
- 📌 Working stickies: "renommer", "shifts / all kpis ?", "predictive shifts", Notion link "Predictive-turnover-engine" — treat nearby details as in-flux.
