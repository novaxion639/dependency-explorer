import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory candidate #4 (billing domain). Traced 2026-06-15 on BOTH
// sides: skello-app-front upsell APIs → svc-billing-automation
// (UpsellManager → Salesforce), and billing's lifecycle write-back into the
// monolith (SkelloManager → v3/api/billing_automation/* controllers,
// from_svc_billing_auto guard — connection added with this flow). Upgrades
// are sales-assisted: the upsell request creates Salesforce interest; the
// actual plan change lands later through Chargebee and billing's step
// functions, which update the monolith and ping the client over websockets.
const subscription_upgrade: ServiceFlow = ServiceFlowSchema.parse({
  "id": "subscription-upgrade",
  "name": "Subscription Upsell & Lifecycle",
  "description": "A manager requests an upsell (plan feature/upgrade) from the settings UI. The front calls svc-billing-automation directly; UpsellManager records the interest in Salesforce — upgrades are sales-assisted, not self-checkout. When the subscription actually changes (Chargebee ↔ Salesforce on the billing side), billing's step functions process the change: organisation/shop/license state is written back into the monolith (SkelloManager → v3/api/billing_automation/* controllers, from_svc_billing_auto), the client is pinged over the LEGACY websockets queue (pingTypeAndUuid), and notification emails go out through comms-v2. Churn follows the same write-back path (Update/DeleteSkelloOrganisation/Shop handlers).",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-billing-automation",
      "action": "Request upsell / upsell interest (base-app svcBillingAutomation Upsell APIs — RequestUpsellBodyDto, UpsellInterestBodyDto)"
    },
    {
      "from": "svc-billing-automation",
      "to": "skello-app",
      "action": "Write back organisation/shop/license state (SkelloManager → v3/api/billing_automation/*, from_svc_billing_auto)"
    },
    {
      "from": "svc-billing-automation",
      "to": "svc-websockets",
      "action": "Ping the client on completion (SfnPushWebsocketJobHandler → websocket-pingTypeAndUuid queue — legacy websockets)"
    },
    {
      "from": "svc-billing-automation",
      "to": "svc-communications-v2",
      "action": "Subscription notification emails (existing verified edge — invoices, payment failures, subscription changes)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-up-upsell-manager",
      "service": "svc-billing-automation",
      "kind": "manager",
      "label": "UpsellManager",
      "path": "src/Manager/UpsellManager.ts",
      "description": "Handles upsell requests and interest — sendUpsellInterest lands in Salesforce (SalesforceRepository); sales takes over from there"
    },
    {
      "id": "cu-up-chargebee-manager",
      "service": "svc-billing-automation",
      "kind": "manager",
      "label": "ChargebeeManager",
      "path": "src/Manager/ChargebeeManager.ts",
      "description": "Subscription state against Chargebee — the billing provider (Salesforce ↔ Chargebee per the GLOBAL board). Orchestration between Chargebee events and the write-back/notification steps runs through billing's step functions (serverless/functions/stepFunctions.ts), not direct manager calls."
    },
    {
      "id": "cu-up-lifecycle-handler",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "ChurnProcess handlers (Update/DeleteSkelloOrganisation/Shop)",
      "path": "src/Handler/Job/ChurnProcess/UpdateSkelloOrganisationHandler.ts",
      "description": "Step-function/SQS steps applying subscription lifecycle changes — each drives SkelloManager's monolith write-back"
    },
    {
      "id": "cu-up-skello-manager",
      "service": "svc-billing-automation",
      "kind": "manager",
      "label": "SkelloManager",
      "path": "src/Manager/SkelloManager.ts",
      "description": "Monolith write-back client (SKELLO_HOST + SKELLO_API_KEY + SKELLO_BILLING_API_PATH) — organisation/shop/license upserts and churn deletions"
    },
    {
      "id": "cu-up-ws-job",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnPushWebsocketJobHandler",
      "path": "src/Handler/Job/Event/SfnPushWebsocketJobHandler.ts",
      "description": "Step-function step pinging the client over the legacy websockets pingTypeAndUuid queue when billing flows complete"
    },
    {
      "id": "cu-up-mono-api",
      "service": "skello-app",
      "kind": "controller",
      "label": "billing write-back surface (from_svc_billing_auto guard)",
      "path": "app/controllers/v3/api/billing_automation/organisations_controller.rb",
      "description": "v3/api/billing_automation/{organisations,shops,users} — upsert/update/destroy/cancel_free_trial, callable only by svc-billing-automation"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-up-upsell-manager",
      "label": "request upsell / interest",
      "mode": "sync"
    },
    {
      "from": "cu-up-upsell-manager",
      "to": "dynamo-billing",
      "label": "billing records",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-up-lifecycle-handler",
      "to": "cu-up-skello-manager",
      "label": "apply subscription/churn change",
      "mode": "sync",
      "condition": "plan change processed (sales-driven, via step functions)"
    },
    {
      "from": "cu-up-skello-manager",
      "to": "cu-up-mono-api",
      "label": "org/shop/license upserts + churn deletions",
      "mode": "sync"
    },
    {
      "from": "cu-up-ws-job",
      "to": "svc-websockets",
      "label": "websocket-pingTypeAndUuid (SFN completion step)",
      "mode": "async-job"
    },
    {
      "from": "cu-up-mono-api",
      "to": "pg-skello-billing",
      "label": "organisation / license state",
      "mode": "sync",
      "crud": ["update", "delete"]
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-billing",
      "type": "dynamodb",
      "label": "svcBillingAutomation-{env}",
      "description": "Billing service state — upsell requests, subscription mirror, credit balances"
    },
    {
      "id": "pg-skello-billing",
      "type": "postgresql",
      "label": "skello_production — organisations, licenses, shops",
      "description": "Monolith state updated by billing's write-backs"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-billing-automation",
      "to": "dynamo-billing",
      "label": "billing state",
      "crud": ["create", "update"]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-billing",
      "label": "apply license changes",
      "crud": ["update"]
    }
  ]
})

export default subscription_upgrade
