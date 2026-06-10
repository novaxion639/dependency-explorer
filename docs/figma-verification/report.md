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

## SvcSearch — [SvcSearch Architecture](https://www.figma.com/board/6ASm6jhm9JiX38mPHW82WD) (2025-11)

- ✅ **No HTTP API — confirmed** (no API GW, only ingestion Lambdas); ✅ MongoDB (**Atlas**) as the terminal store of every flow — this IS the "Collection SvcSearch" other boards' readers query over VPC.
- ✅/⚠ Monolith ingestion = **DMS Full-Load/CDC** ("RDS PostgreSQL skelloapp" → DMS → IngressRDS → Mongo) — confirms svc-search→skello-app directionally, but our edge says "SDK client / rest": it's database-level replication, no HTTP. **Edge transport needs correction.**
- 🆕 Second ingestion path: other services' **DynamoDB tables ("Service 1..3, …") → IngressDynamoDB** (streams) — explains svcpos-transaction/forecast collections; unmapped.
- ⚠ **Our 5 producer REST edges (trackers/shops/kpis-v2/employees/workload-plan → svc-search "indexes …") contradicted**: there is no API to push to; ingestion is pull-based. Hypothesis: `@skelloapp/svc-search-sdk` is the shared VPC-Mongo *client library* (explaining the value imports) — verify in skello-libs-ts, then flip these edges to Mongo-read/replication semantics.
- ⚠ Map's s3 + index-dlq stores not drawn; ❓ IngressDynamoDB→Mongo edge undrawn (unfinished); ❓ "skelloapp-bus" label under the DMS icon ambiguous.

## SvcShifts — [SvcShifts](https://www.figma.com/board/kKyzTsDJk2swAf1sBsVJot) (2025-11)

- ⚠ **Cover-only stub** (title card, zero shapes/connectors) — nothing verifiable.
- ⚠ **GITHUB link points to `skelloapp/svc-kpis`** — copy-paste error or svc-shifts lives in the svc-kpis codebase; confirm (map models them as separate services).
- 📌 Internal map finding: skello-app→svc-shifts `usedEndpoints` lists only shop-and-orga metrics while six flows call `POST /shift-metrics/employee` — add `api-get-employee-shift-metrics` to the edge.

## svc-trackers — [svc-trackers](https://www.figma.com/board/m2wR4jn9FewgBBf50DrBKD) (2026-02)

- ✅ MongoDB store confirmed; ✅ apiGetTrackers ↔ our get/bulk-fetch endpoints.
- ⚠ **Service identity corrected**: the board (in project "SvcCounter") shows per-counter workflow Lambdas (bankHoliday, pto, hours, rtt…) — this is the **labour-law hour/leave counters service**, not "project and task-based time logging"; no geofencing anywhere. → Map description fixed in this branch.
- 🆕 Event-driven core unmapped: **Kinesis → router → SNS fan-out → per-counter workflows → Mongo** (+ shopCreated consumer); zero async edges in map.
- ❓ apiGetRawTrackers "meant to be used by the agent" — unidentified consumer; ❓ trackers→svc-search and trackers→skello-app SDK edges unverified by board (Kinesis may be the real ingestion).
- 📌 8 of our 10 endpoints not drawn (map is ahead of the 2026-02 sketch).

## SvcEnrollment — [employee onboarding](https://www.figma.com/board/1K20VER0W2QLgASTBoqygn) (2026-04)

- ✅ enrollment→svc-labour-laws confirmed (EmployeeOnboardingConfigGetDefault → SvcLabourLaws — default onboarding config lookup); ✅ front→enrollment via SDK; ✅ DynamoDB SvcEnrollment.
- ⚠ enrollment→svc-employees not on this page (code evidence stands); ⚠ SDK drawn as **SvcOnboardingSdk** vs our svc-enrollment-sdk (rename?).
- 🆕 **Two unmapped Vue callers: skello-onboarding and skello-selfServe** (both via the same SDK); 🆕 ToData Firehose→S3 RawData export; 🆕 GetDefault + Onboarding Delete endpoints not in map.
- ❓ Unwired SkelloApp/SvcDocuments/SvcCommunications embeds (planned integrations? probe code first).

## SvcBillingAutomation — [[Architecture] SvcBillingAutomation (no-edit)](https://www.figma.com/board/PzKSK1Qs6j6bC2fxJ9wch3) (2026-04)

- ✅ ~36 routes match our scaffolded endpoints; ✅ DynamoDB; ✅ skello-app caller; ✅ →svc-modularisation (JobSfnGetFeatures); ✅ assistant retirement consistent (zero mentions).
- ⚠ **Provider is Chargebee, not Stripe** — dedicated Chargebee section (checkout, portal, sources, billing dates), zero Stripe; our own endpoints are all chargebee_*. → Service description fixed in this branch.
- 🆕 **Salesforce: major unmapped integration** — ~20 connectors incl. inbound SF→API callbacks (ApiNotify* webhook-style endpoints), JobSfnValidationSalesforce; 🆕 reverse **billing→skello-app** provisioning edges (JobSfnCreateUser/UpsertOrganisation/UpsertShops, "If subscription activation requested"); 🆕 **billing→websockets** (JobSfnPushWebsocket); 🆕 Zapier (request-upsell) + INSEE SIRENE (company registrations); 🆕 3 Step Functions (Provisioning, Contract Change, Shop Sync ×100-shop batches), 6 named SQS queues, Firehose replication, KMS.
- ❓ S3/SNS map stores not drawn; →comms only hinted (SFN SendEmail step); →svc-users not drawn (JobSfnCreateUser targets the monolith instead); v2026/* route family absent (board predates it).

## SvcDocumentsV2 — [[Architecture] SvcDocuments V2](https://www.figma.com/board/s5TnLvlr4usoNFRklwl8HI) (2025-10)

- ✅ **Signature absorption CONFIRMED**: own /signatures lambdas + full Yousign webhook chain + SFN SignatureRequest (create→signers→document→activate) — signature lifecycle owned here; Yousign drawn directly on THIS board.
- ✅ Core document CRUD routes match; ✅ DynamoDB+S3 (+KMS) match; ✅ skello-app inbound drawn — but via **SQS SendDocument → ReceiveDocuments**, an async ingestion the map models as sync-only.
- 🆕 Kinesis **skelloAppBus → SkelloAppSyncEmployee** + SNS **MergeShop→SQS** consumption (the shop-merge fan-out again); 🆕 Firehose→S3 RawData export; 🆕 8 named DLQs vs our 1 generic; 🆕 thumbnail/index/file-listener lambdas.
- ⚠ Board ("Done" v2.0) covers ~13/39 endpoints — templates/folders/avatars surfaces postdate it; signature route shapes diverged (per-id reminder vs our bulk /signatures/reminders; DELETE /{id} vs POST /cancel) — the map (deploy-config-derived) is current.
- ⚠ The extract-data SQS path to svc-intelligence is absent (postdates board); inbound callers (intelligence/comms/bff/front/esignature) not drawn.
- ❓ CONFIRMED map smell: usedEndpoints on most docs-v2 edges list signature-reminder ids while descriptions say print/generate/fetch — merge-era copy-paste, do not trust as route evidence (enrichment backlog).

## SvcBff + SvcBffPlanning — [SvcBff](https://www.figma.com/board/J4CNNc8QTHIDaoGKfjpgYq) · [SvcBffPlanning](https://www.figma.com/board/EXC4HBaYoO9y4tbfPApwHO) (2025-11)

- ⚠ **Both boards are cover-only stubs** (one frame each; verified via screenshots + page enumeration). Our map remains the only record of the BFF fan-out.
- ⚠ GITHUB links wrong on both: SvcBff → `skelloapp/svc-kpis`, SvcBffPlanning → `skelloapp/svc-workload-plan` (masking that the real bff-planning repo was deleted).
- ⚠ SvcBffPlanning chip says "Active" — contradicts the decommissioned reality; ❓ its node ids start at 33:500 (prior content possibly wiped).
- 📌 Governance: fix links, flip status, draw or delete the stubs.

## SvcPunch — [[Architecture] SvcPunch (no-edit)](https://www.figma.com/board/F6rmHpIRdXcH5dhBPGMRab) (2025-06)

- ✅ 20/31 routes drawn and matching; ✅ single-DynamoDB design confirmed; ✅ svc-punch-sdk entry + Route53/ACM.
- 🆕 **MergeShop SNS → MergeShopSqs → MergeShopJob → DynamoDB on the board** — confirms our queue-cross-ref finding; publisher still unidentified (orphan topic — presumably monolith/shops on shop merge). Same fan-out now seen on punch, kpis-v2, docs-v2 boards.
- 🆕 **skelloAppBus Kinesis → SyncSkelloApp(Users/Memberships/Shop) → DynamoDB** — how /users routes are served; no async skello-app→punch edge in map; 🆕 stream consumers (location purge) + Firehose→S3 RawData export + 4 named DLQs; 🆕 lateness-SMS Step Function (marked POC — cron → Search → AutorizeSms → SendSms → UpdateShifts; implies undeclared outbound deps if shipped).
- ⚠ 11 map endpoints not drawn (public punch-device routes, settings aliases); ⚠ no service callers drawn; ❓ svc-users edge's usedEndpoints (api-create-clock-in-out) looks wrong for "token provisioning".

## Cross-board patterns (sweep #2)

1. **skelloAppBus (monolith CDC Kinesis) is an unmapped async backbone** — consumed by svc-employees (Fortify job), svc-punch (users/memberships/shop sync), svc-documents-v2 (SkelloAppSyncEmployee), svc-kpis-v2 (weekly-options full load via DMS→Kinesis), svc-search (via DMS), svc-automatic-scheduling (position events). Modeling decision needed: per-consumer async edges from skello-app, or a first-class bus entity.
2. **MergeShop SNS fan-out** — punch + kpis-v2 + docs-v2 consume; publisher unidentified.
3. **AWS DATA Firehose→S3 RawData export** — drawn on every service board (reports, comms, esignature, employees, kpis, enrollment, billing, docs-v2, punch); a per-service convention, candidate for schema-level representation rather than per-flow nodes.
4. **Cover-only stubs**: svcHris, SvcShifts, SvcBff, SvcBffPlanning — with wrong GITHUB links on three; governance list for the architects.

## GLOBAL — [[Architecture] Skello](https://www.figma.com/board/zOrx26nmHB4KHFpZkRm5eT) (2026-02)

- Inventory: 62 systems (37 internal + 25 external), 39 connectors. **29 of our 32 services drawn** (each embedding its per-service board); inter-service edges deliberately delegated to those boards (only billing↔modularisation drawn globally, ✅ matches).
- ✅ **SvcDocumentsEsignature marked "(deprecated)" on the board** — corroborates our decommission watch (and contradicts its own service board's "Active" chip).
- 🆕 Unmapped internal systems: **SvcBitlyV2** (Lambda+DynamoDB URL shortener), **Metabase** (ECS+Aurora BI), **SmartPlanner (deprecated)** (EC2 legacy auto-planner), **SvcKpis v1 (deprecated)** (Lambda+RDS), **SkelloSelfServe** + **SkelloOnboarding** (S3+Vue fronts — matching enrollment's unmapped callers), **SkelloMobile** + **SkelloPunchClock** (React Native apps).
- 🆕 Unmapped infra: front-ends ↔ **API Gateway "Websocket"** (no front→websockets edge in map); external **ALB → monolith "tcp:80"**; **DMS CDC "BusNotifications" ↔ Kinesis** on the monolith (the skelloAppBus backbone, drawn globally); **Services → Kinesis → S3 raw-data (Account DATA) → Looker**.
- 🆕 External integrations with explicit connectors (none in map): POS→REVO/Agora/L'Addition/**Chift**; comms↔**Brevo/smsmode/Expo**; esignature→**Yousign**; intelligence→**OpenAI** (+Bedrock icon); hris→**Kombo**; employees→**Fortify↔Silae**, **Urssaf API**, **Cegedim**; **monolith→Stripe**(!); billing↔**Salesforce** (+Chargebee↔Salesforce); Salary-Advance partners (SPAYR, ROSALY)→Looker; **Webflow** marketing entry; partner groups (POS/PAY/Analytics/HRIS clients) ↔ monolith.
- ⚠ Not drawn: svc-trackers, svc-automatic-scheduling (SmartPlanner-deprecated likely its predecessor slot), svc-payroll.
- ❓ BFF→"Account PROD" connector unspecific; Urssaf/Cegedim sections contain silae.fr link-preview leftovers; board "©2023" template with 2026-02 content.

## SvcIntelligence — [Global architecture](https://www.figma.com/board/eDPQ5NdaL21dntzI1kfL3n) (2025-11)

- ✅ Analysis pipeline matches /analyse: RequestAnalysis → analyseDocumentSQS → AnalyseDocumentStepFunction (GetDocument→GetPrompt+ExtractDocumentText→AnalyseDocument→write DynamoDB); ✅ →docs-v2 GetDocument edge; ✅ DynamoDB+S3+DLQs; ✅ front ingress.
- 🆕 **Both Bedrock (Claude3) AND OpenAI (GPT-4)** in the LLM section; 🆕 **Textract** table extraction with SFN task-token + completion **SNS** → release; 🆕 **websocket push** (DynamoDB stream → NotifyClient → Websocket) — candidate svc-intelligence→svc-websockets-v2 edge (corroborated by the v1 websocket board's GenericMessage producer); 🆕 GET /ai/{shopId}/entities endpoint; 🆕 Firehose→S3 RawData export.
- ⚠ Board ingress is HTTP POST /ai/{docId}/analysis/{type} — predates the docs-v2 SQS hand-off we verified in code; ⚠ board shows NO MongoDB (map claims one; kpis + global boards drew Mongo under intelligence — conflicting, code check needed); ⚠ validation surface absent (postdates board).
- 📌 CONFIRMED again: intelligence→docs-v2 usedEndpoints are signature-reminder copy-paste artifacts.

## SvcUsers — [[Architecture] SvcUsers (no-edit)](https://www.figma.com/board/ioDtRODjqmMuKaIzNgh0gW) (2026-04, "Overview" page)

- ✅ DynamoDB; ✅ SSO config/callback endpoints; ✅ login-capability; ✅ →comms reset-password HIGH email via SQS; ✅ sdk entry ("old skello-auth-client" naming confirmed!).
- 🆕 **POST /sign-up is real** (SignUp Lambda → DynamoDB via ALB) — SDK had it, scaffold dropped it as unmatched → **restored in this branch** (manual provenance, board+SDK dual evidence).
- 🆕 **Dual entry: API GW svc-users.skello.io + ALB auth.skello.io** (login/refresh/reset/sign-up via ALB) — unmapped route family (POST /v3/login, refresh_token, temporary-password, reset-password, mobile SSO redirect); 🆕 **svc-users→skello-app missing edge** (3 authorizer Lambdas call monolith; ComparePayloadJob GET /private/svc_users/payloads drift audit; reads skelloapp-readReplica; consumes skelloAppBus + FullLoadBus — sticky lists replicated pk prefixes); 🆕 Google Workspace as the OIDC IdP; 🆕 data-lake export.
- ⚠ Map's `postgresql svc_users` store suspect — board shows only the monolith's readReplica (mis-attribution; endpoints' pg awsCalls too); ⚠ **svc-punch→svc-users async exists on board** (SNS svcPunchMobilePermissions → SQS → UpdateEmployeePunchMobilePermission) while our svc-users→svc-punch sync edge is unverified by it — possible direction error to re-check in code.
- ❓ "monthly"/"Overview With SSO"/"Full load" pages unfetched (page node-ids needed).

## SvcWorkloadPlan — [with mongo](https://www.figma.com/board/cEwC3Z9GHvwDvQ2SYuVwI6) (2026-02)

- ⚠ **Board is Mongo-ONLY** ("with mongo" = post-migration; zero DynamoDB) — our flows persist plans to DynamoDB svcWorkloadPlan-{env}: likely stale, verify serverless/db client then repoint flow stores.
- ✅ 6/9 routes drawn; ✅ Route53/ACM/API GW; ✅ **MergeShop SNS→SQS→Job→Mongo: 4th confirmed consumer** (validates the mergeShopSqs from its serverless config).
- ⚠ No callers drawn; SDK box named svc-workload-plan-sdk vs our workload-plan-sdk (rename smell, cf. enrollment); ❓ no revenue/kpis input drawn (our code-evidenced kpis edge stands); 📌 exception: no Firehose RawData export drawn.

## SvcRequests — [Architecture Phase 2](https://www.figma.com/board/B1sY9VGM1XUVgoYL0zYKtK) (2026-03)

- ✅ All 6 endpoints drawn; ✅ RDS PostgreSQL SvcRequests; ✅ both comms lanes per event (Notification+Mail ×Created/Accepted/Transferred) — consistent with our HIGH email+notification correction; ✅ monolith-origin notifications stay in skello-app (Kinesis filters origin != skelloApp) — reconciles with our lifecycle flow.
- 🆕 **PATCH /leave-request/transfer/{id}** + Transferred lifecycle state (unmapped endpoint+state); 🆕 **svc-requests→skello-app missing edges ×2**: CreateShifts write-back (Kinesis filter approved non-monolith → POST /private/shifts + retries) and GetPreSelectedManager sync managers fetch; 🆕 comms fan-out is **CDC-driven** (RDS→DMS task→Kinesis SvcRequests→SQS lanes), not API-enqueue; 🆕 inbound DMS replication of monolith leave_requests/**shops/users/postes** (local replicas); 🆕 **MergeShops 5th consumer**; 🆕 nightly purge cron (bug: `* 3 * * *` = every minute of 3am); 🆕 data-lake export.
- ⚠ Our svc-requests→svc-events ActivityLogCreateSqs edge not drawn (code evidence stands — flag to board owners); ⚠ our svc-requests-sns awsCalls don't match (the only SNS is the CDC-dispatch topic); ❓ comms-v2→svc-requests reverse read edge unverified by board; ❓ SvcUsers box near the authorizer (semantics undrawn); 📌 Rejected/Cancelled notification lanes absent; 📌 "To delete after release" full-load section = strangler-pattern phase boundary.

## SvcSkelloAssistant — [Freemium](https://www.figma.com/board/tcpnXQNDkfle7r7wt7cls2) (2026-01)

- ✅ Surviving front→assistant /chat edge confirmed; ✅ 3 of 4 retirements supported (zero comms/docs-v2/esignature traces).
- ⚠ **Retirement CONTESTED: assistant→svc-billing-automation** — the freemium design hinges on GET /credits-balance + POST /use (atomic credit decrement), and billing's map model carries both endpoints **orphaned** (no connection references them). All-Lambda architecture → invocation plausibly via env-configured API GW URL, invisible to import/queue/URL diligence. **Re-verify against assistant's serverless env/terraform before standing by the retirement.**
- 🆕 **Bedrock** LLM; 🆕 internal chatSQS async hop; 🆕 WebSocket stream response to the front (no assistant↔websockets edge anywhere); 🆕 adjacent billing→skello-app GET /features (feature state + admin count) — second sighting (billing board's JobSfn* too).
- ❓ Board silent on assistant storage (map's MongoDB checkpoint claim untested); 📌 design artifact (2026-01) — prompt to re-audit, not proof of shipped code.

## SvcPos — [[Architecture] SvcPos (no-edit)](https://www.figma.com/board/O5yJE3YE1oNdyHDDIzczVa) (2025-12)

- ✅ 10/17 endpoints drawn (integration/provider CRUD + run); ✅ DynamoDB SvcPos; ✅ sdk entry.
- ⚠ **CHIFT absent** — board still shows direct cron pulls (05:00 Mon–Fri) from **ADDITION/REVO/AGORA** provider APIs → Transaction SQS → DynamoDB; our 6 chift routes postdate it (board stale on integration shape; global board already draws Chift).
- 🆕 Egress unmapped ×3: Firehose→S3 RawData; **AggregationEvent SQS → SkelloApp** (aggregated POS revenue toward the monolith); outbound provider pulls. 🆕 Inbound skelloAppBus Kinesis → SyncSkelloAppShops.
- ❓ kpis→pos edge stays **CONTESTED** (kpis not drawn as caller; api-get-chift-providers not even on board; consistent with kpis-via-svc-search-collections); ⚠ both inbound edges' usedEndpoints (api-get-chift-providers only) look wrong; 📌 mislabeled `SvcPunchToFirehoseHandler` Lambda wired to AggregationEvent (copy-paste or shared queue — ask team).

## svc-websockets-v2 — [[Architecture] Websocket (no-edit)](https://www.figma.com/board/e3TYpYB99jopQhYsSV62SJ) (2024-03)

- 📌 **v1 board; our map models v2** — three type-specific queues (PingShopIdAndDate/PingTypeAndUuid/GenericMessage) vs v2's single topicMessage+DLQ; no topics, no auth, no replay drawn; DynamoDB "websocket" (likely connections-only).
- 🆕 v1 producers drawn that corroborate other boards' claims: **SkelloApp**, **SvcBillingAutomation** (JobSfnPushWebsocket ✓), **SvcIntelligence** (GenericMessage ✓). Whether they migrated to v2's topicMessage = the code check that would mint front/billing/intelligence→websockets edges.
- 📌 Board should be marked superseded / a v2 board drawn (governance list).

## Cross-board patterns (sweep #3 additions)

5. **Strangler-pattern monolith coupling is bidirectional and CDC-heavy**: services keep local replicas of monolith tables (requests: leave_requests+shops+users+postes via DMS; users: 8 pk prefixes via skelloAppBus+readReplica; search: whole-DB DMS; kpis: weekly_options) AND write back through private monolith endpoints (requests CreateShifts, employees facade PATCH, users payload drift-audit, billing provisioning, auto-scheduling assignShifts). The map's sync-REST-only lens under-represents both directions.
6. **MergeShop fan-out consumers now: punch, kpis-v2, docs-v2, workload-plan, requests** (5). Publisher still unidentified — top code-verification priority.
7. **SDK rename smell**: boards label SDKs SvcOnboardingSdk / svc-workload-plan-sdk / "svc-users-sdk (old skello-auth-client)" — registry ground truth lives in skello-libs-ts.
8. **Orphaned endpoints as integration evidence**: billing's credit-balance pair orphaned in our map ↔ assistant freemium board uses exactly them. Orphan endpoints deserve a standing drift check.

---

## Code-check queue — board claims verified against source (2026-06-10)

The 8 contested items queued during sweeps #1–3, each settled in code:

1. **assistant→billing retirement OVERTURNED** ✅ — `svc-skello-assistant/serverless/src/agent/Client/BillingAutomationClient.ts` (2026-05-05) holds a value import of `@skelloapp/svc-billing-automation-sdk` calling `getCreditBalanceWithApiKey()` + `useCredit()` (featureKey `ai_agent`) — exactly billing's two orphaned endpoints `api-get-credit-balance`/`api-use-credit-balance`. Root cause of the false retirement: the repo has **no root package.json** (deps live in `serverless/package.json`), and the TS extractor only read the root. Extractor fixed (`findPackageDirs` — nested package.json walk, used by dep scan, import classification and SDK call-site verification). The fix surfaced 5 more hidden assistant SDKs (documents-v2, **esignature**, search, shifts) and `skello-app-front → svc-websockets-v2`. The Freemium board was right.
2. **MergeShop publisher = the monolith** ✅ — `skello-app/app/services/shop_merge_service.rb:123` publishes to `ENV['SNS_MERGE_SHOP_ARN']`, triggered by Sidekiq job `Shops::MergeShopsJob`. Consumers verified in serverless config: svc-punch (pulls `skelloApp/SNS_MERGE_SHOP_ARN` from SSM), svc-kpis-v2 (`SnsMergeShopSubscription`), svc-workload-plan (`MergeShopSqs`), svc-requests (`sqsMergeShop`). **svc-documents-v2 has NO MergeShop queue or handler** — the boards' fifth consumer doesn't exist in code. 4 SNS fan-out edges added.
3. **svc-search-sdk is a DTO contract, not a client** ✅ — `skello-libs-ts/packages/svc-search-sdk` exports only `Raw*Dto`/Entity attributes/enums (no HTTP code, no Mongo connection code). Every consumer connects itself via SSM `svcSearch/MONGO_DB_*` (verified in trackers, shops, kpis-v2, employees, auto-scheduling, workload-plan, assistant). All 7 X→svc-search edges re-typed `protocol: mongodb`; the fabricated "indexes via REST" descriptions replaced with the actual repositories read. `svc-search → skello-app` re-typed `cdc` (its only skello-app-sdk import is the `BodySizeMapping` constant). New protocol enum values: `mongodb`, `postgresql`.
4. **Strangler reverse edges confirmed** ✅ — svc-users → skello-app: Lambda authorizer validates against the monolith API (`AuthorizerSkelloAppRepository`, SSM `SKELLO_APP_USERS_API_KEY`) AND reads the monolith RDS **read-only replica** directly (`/skl/{env}/skelloapp/rds/db_url_svc_users-ro` — the board's "postgresql svc_users" box is this replica, not an owned store; service model corrected). svc-requests → skello-app: `CreateShiftsJobHandler → SkelloAppManager` (SSM `SKELLO_APP_REQUESTS_API_KEY`) — the POST /private/shifts write-back the board drew. Both edges added.
5. **punch↔users direction: board wrong** ✅ — zero svc-users references in svc-punch source (no SDK, no queue). The map's `svc-users → svc-punch` sync/rest (token provisioning) stands; no reverse edge exists.
6. **workload-plan Dynamo→Mongo migration COMPLETE** ✅ — container binds `Repository/MongoDB/WorkloadPlanRepository` (own Mongo via SSM `{serviceName}/MONGO_DB_URI`); the DynamoDB repository class is unbound residue. Service model + both workload flows corrected. Bonus: workload-plan also reads search's raw shops (`RawShopRepository` + SSM svcSearch) — 7th shared-Mongo consumer edge added.
7. **intelligence Mongo claim CONFIRMED** ✅ — and better: the assistant stores its conversations + LangGraph checkpoints **in svc-intelligence's MongoDB** (`MongooseInstance.ts`: "FOR continuity we keep using svc int mongo db"; collections conversations/checkpoints/checkpoint_writes with TTL). Shared-store coupling edge added.
8. **websockets v1→v2 producer migration INCOMPLETE** ✅ — front: migrated (value import of the v2 SDK). svc-intelligence: still sends to `websocket-genericMessage-{stage}`; svc-billing-automation step functions: still send to `websocket-pingTypeAndUuid-{stage}`. Neither queue belongs to v2 (its only ingestion queue is `websocket-topicMessage`). Legacy `svc-websockets` service added (tag `decommission-watch`) with both producer edges.

**Net dataset effect:** 98 → 113 connections (100 discovery-verified), 33 services, multi-channel pairs now legal (uniqueness = from→to:protocol — skello-app talks REST *and* shop-merge SNS to punch/requests), 34 tests green, 0 candidates / 0 stale / 0 flow findings.

**New leads queued by this pass:** assistant's esignature dependency is LIVE (decommission plan must include it); front still declares legacy `svc-kpis-sdk` + `skello-analytics-client` (unknown targets); svc-kpis repo has 6 HTTP endpoints + 3 queues but no service definition.
