import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. Revenue enters by scheduled POLLING of
// provider APIs — Chift webhooks carry connection state only, never revenue.
const pos_revenue_ingestion: ServiceFlow = ServiceFlowSchema.parse({
  "id": "pos-revenue-ingestion",
  "name": "POS Revenue Ingestion",
  "description": "Till revenue lands in Skello by scheduled polling — an EventBridge cron (prod 03:00 UTC daily) dispatches one job per active integration (Chift/REVO/Agora/Addition); the Chift webhook surface only toggles connection state (HMAC-256, no gateway authorizer) and never carries revenue. Pipeline: dispatcher → IntegrationJobQueue → PullTransactionJob (provider API fetchTransactions) → TransactionQueue → WriteTransactionJob → DynamoDB. The table stream fans out twice: an aggregation leg (FIFO queue → ComputeAggregationService → HTTP write of day KPIs into the monolith's weekly options) and a datalake leg (Firehose → S3). svc-kpis-v2 reads its `transactions` Mongo collection read-only to derive revenue/guests/quantity/productivity KPIs (manual > transaction > forecast merge) served over POST /kpis — consumed by dashboards and svc-workload-plan calibration. HOW the svc-pos transactions reach that Mongo collection is NOT provable from these repos (no direct write exists; likely datalake-side ETL) — recorded as a boundary, not guessed. Every queue carries its own DLQ; manual re-runs exist (POST /integrations/{shopId}/run, api-key only) plus a historical full-load dispatcher.",
  "trigger": { "actor": "system", "role": "EventBridge cron — providers ADDITION/REVO/AGORA/CHIFT (prod cron(0 3 * * ? *))" },
  "links": [
    { "to": "workload-plan-consultation", "kind": "continuation", "note": "svc-workload-plan calibrates against the revenue KPIs this pipeline produces (fetchAllKpis)" }
  ],
  "steps": [
    {
      "from": "svc-pos",
      "to": "skello-app",
      "action": "Aggregated day KPIs → updateShopWeeklyOptionsKpis (HTTP into weekly options)"
    },
    {
      "from": "svc-kpis-v2",
      "to": "svc-pos",
      "action": "Reads raw POS `transactions` Mongo (read-only) → revenue KPIs (hydration mechanism external to both repos — datalake ETL boundary)"
    },
    {
      "from": "svc-workload-plan",
      "to": "svc-kpis-v2",
      "action": "POST /kpis (svc-kpis-v2-sdk fetchAllKpis) — calibration read"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pri-dispatch-mgr",
      "service": "svc-pos",
      "kind": "manager",
      "label": "IntegrationDispatcherManager",
      "path": "src/Manager/IntegrationDispatcherManager.ts",
      "description": "Cron-fired — builds one IntegrationJobEvent per active integration, batchSend to SQS"
    },
    {
      "id": "cu-pri-pull-handler",
      "service": "svc-pos",
      "kind": "job",
      "label": "PullTransactionJobHandler",
      "path": "src/Handler/Job/PullTransactionJobHandler.ts",
      "description": "IntegrationJobQueue consumer (batch 1, concurrency 5) — provider fetchTransactions, results onto TransactionQueue"
    },
    {
      "id": "cu-pri-pull-service",
      "service": "svc-pos",
      "kind": "service",
      "label": "PullTransactionService",
      "path": "src/Service/PullTransactionService.ts",
      "description": "integrationProvider.fetchTransactions(integration, start, end) — Chift SDK / REVO / Agora"
    },
    {
      "id": "cu-pri-write-handler",
      "service": "svc-pos",
      "kind": "job",
      "label": "WriteTransactionJobHandler",
      "path": "src/Handler/Job/WriteTransactionJobHandler.ts",
      "description": "TransactionQueue consumer (batch 25) — TransactionModel rows into DynamoDB"
    },
    {
      "id": "cu-pri-push-agg",
      "service": "svc-pos",
      "kind": "job",
      "label": "PushAggregationEventJobHandler",
      "path": "src/Handler/Job/PushAggregationEventJobHandler.ts",
      "description": "Dynamo-stream consumer (TRANSACTIONS INSERT/REMOVE) — AggregationEventEntity onto the FIFO queue"
    },
    {
      "id": "cu-pri-compute",
      "service": "svc-pos",
      "kind": "service",
      "label": "ComputeAggregationService",
      "path": "src/Service/ComputeAggregationService.ts",
      "description": "Aggregates the day's transactions → updateShopWeeklyOptionsKpis into the monolith"
    },
    {
      "id": "cu-pri-datalake",
      "service": "svc-pos",
      "kind": "job",
      "label": "SendToDatalakeJobHandler",
      "path": "src/Handler/Job/SendToDatalakeJobHandler.ts",
      "description": "Dynamo-stream consumer — TRANSACTIONS/INTEGRATIONS/ORGANISATION_CONFIG rows to Kinesis Firehose (S3 datalake)"
    },
    {
      "id": "cu-pri-chift-webhook",
      "service": "svc-pos",
      "kind": "controller",
      "label": "ChiftWebhookController",
      "path": "src/Controller/Chift/ChiftWebhookController.ts",
      "description": "HMAC-256 webhook — account.connection.created/updated ONLY (connection state, never revenue); no gateway authorizer"
    },
    {
      "id": "cu-pri-kpis-mgr",
      "service": "svc-kpis-v2",
      "kind": "manager",
      "label": "KpiTransactionManager",
      "path": "src/Manager/KpiTransaction/KpiTransactionManager.ts",
      "description": "Derives revenue/guests/quantity/productivity from transactions; merge precedence manual > transaction > forecast"
    },
    {
      "id": "cu-pri-kpis-repo",
      "service": "svc-kpis-v2",
      "kind": "service",
      "label": "TransactionRepository",
      "path": "src/Repository/Mongo/TransactionRepository.ts",
      "description": "Read-only aggregate over the `transactions` Mongo collection (raw POS data)"
    },
    {
      "id": "cu-pri-wp-mgr",
      "service": "svc-workload-plan",
      "kind": "manager",
      "label": "KpisManager",
      "path": "src/Manager/KpisManager.ts",
      "description": "fetchAllKpis via svc-kpis-v2-sdk — the calibration read"
    }
  ],
  "codeEdges": [
    { "from": "cu-pri-dispatch-mgr", "to": "sqs-pos-integration", "label": "IntegrationJobEvent batchSend", "mode": "async-job", "crud": ["create"] },
    { "from": "sqs-pos-integration", "to": "cu-pri-pull-handler", "label": "per-integration pull", "mode": "async-job" },
    { "from": "cu-pri-pull-handler", "to": "cu-pri-pull-service", "label": "PullTransactionService", "mode": "sync" },
    {
      "from": "cu-pri-pull-handler", "to": "sqs-pos-transaction", "label": "transactions batchSend", "mode": "async-job", "crud": ["create"],
      "failure": { "queue": "TransactionQueue", "dlq": "TransactionDlqQueue", "onError": "A dead-lettered batch delays that till's revenue until redrive or the next day's poll" }
    },
    { "from": "sqs-pos-transaction", "to": "cu-pri-write-handler", "label": "write batch (25)", "mode": "async-job" },
    { "from": "cu-pri-write-handler", "to": "dynamo-svc-pos", "label": "TransactionModel rows", "mode": "sync", "crud": ["create"] },
    { "from": "dynamo-svc-pos", "to": "cu-pri-push-agg", "label": "stream (TRANSACTIONS INSERT/REMOVE)", "mode": "async-event" },
    {
      "from": "cu-pri-push-agg", "to": "sqs-pos-aggregation", "label": "AggregationEventEntity (FIFO)", "mode": "async-job", "crud": ["create"],
      "failure": { "queue": "AggregationEventFifoQueue", "dlq": "AggregationEventFifoDlqQueue", "onError": "Lost aggregation events leave the monolith's weekly-option KPIs stale for that shop-day" }
    },
    { "from": "sqs-pos-aggregation", "to": "cu-pri-compute", "label": "compute day aggregation", "mode": "async-job" },
    { "from": "cu-pri-compute", "to": "skello-app", "label": "updateShopWeeklyOptionsKpis", "mode": "sync", "crud": ["update"] },
    { "from": "dynamo-svc-pos", "to": "cu-pri-datalake", "label": "stream → Firehose", "mode": "async-event" },
    { "from": "cu-pri-datalake", "to": "kinesis-pos-datalake", "label": "svcPos-dataLake delivery", "mode": "async-event", "crud": ["create"] },
    { "from": "svc-pos", "to": "cu-pri-chift-webhook", "label": "POST /chift/webhooks (external Chift — connection state only, HMAC-256)", "mode": "sync" },
    { "from": "cu-pri-kpis-mgr", "to": "cu-pri-kpis-repo", "label": "TransactionRepository aggregate", "mode": "sync", "crud": ["read"] },
    { "from": "cu-pri-kpis-repo", "to": "mongo-kpis-transactions", "label": "raw transactions read", "mode": "sync", "crud": ["read"] },
    { "from": "cu-pri-wp-mgr", "to": "svc-kpis-v2", "label": "fetchAllKpis (POST /kpis)", "mode": "sync", "contractRefs": ["POST /kpis"] }
  ],
  "infraNodes": [
    { "id": "sqs-pos-integration", "type": "sqs", "label": "IntegrationJobQueue (+DLQ)", "description": "One message per active integration per cron firing" },
    { "id": "sqs-pos-transaction", "type": "sqs", "label": "TransactionQueue (+DLQ)", "description": "Pulled provider transactions awaiting the Dynamo write" },
    { "id": "sqs-pos-aggregation", "type": "sqs", "label": "AggregationEventFifoQueue (.fifo, +DLQ)", "description": "Ordered day-aggregation events" },
    { "id": "dynamo-svc-pos", "type": "dynamodb", "label": "svc-pos single-table (+stream)", "description": "TRANSACTIONS/INTEGRATIONS/ORGANISATION_CONFIG — the stream feeds aggregation and datalake" },
    { "id": "kinesis-pos-datalake", "type": "kinesis", "label": "svcPos-dataLake Firehose → S3", "description": "Analytics datalake delivery (svc-pos-tf)" },
    { "id": "mongo-kpis-transactions", "type": "mongodb", "label": "svc-kpis-v2 `transactions` collection", "description": "Raw POS transaction data — read-only in svc-kpis-v2; hydration mechanism external (datalake ETL boundary)" }
  ],
  "infraEdges": [
    { "from": "svc-pos", "to": "dynamo-svc-pos", "label": "transaction writes", "crud": ["create"] },
    { "from": "svc-pos", "to": "sqs-pos-integration", "label": "dispatch" },
    { "from": "svc-pos", "to": "sqs-pos-transaction", "label": "pulled transactions" },
    { "from": "svc-pos", "to": "sqs-pos-aggregation", "label": "aggregation events" },
    { "from": "svc-pos", "to": "kinesis-pos-datalake", "label": "datalake delivery", "crud": ["create"] },
    { "from": "svc-kpis-v2", "to": "mongo-kpis-transactions", "label": "raw reads", "crud": ["read"] }
  ]
})

export default pos_revenue_ingestion
