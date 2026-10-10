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
  "description": "A manager requests an upsell (plan feature/upgrade) from the settings UI. The front calls svc-billing-automation directly; UpsellManager records the interest in Salesforce — feature upsells are sales-assisted. One exception ships alongside ('Autonomous switch' board, verified 2026-07-12): the annual-plan switch is AUTONOMOUS — the front estimates and finalizes shop/organisation contract changes directly (estimate/finalize endpoints), no sales touch. When the subscription actually changes (Chargebee ↔ Salesforce on the billing side), billing's step functions process the change: organisation/shop/license state is written back into the monolith (SkelloManager → v3/api/billing_automation/* controllers, from_svc_billing_auto), the client is pinged over the LEGACY websockets queue (pingTypeAndUuid), and notification emails go out through comms-v2. Churn follows the same write-back path (Update/DeleteSkelloOrganisation/Shop handlers).",
  "trigger": {
    "actor": "account admin"
  },
  "primaryArea": "billing",
  "chapters": [
    {
      "title": "A manager asks for an upsell",
      "summary": "The settings page sends the request straight to svc-billing-automation, which records it and hands the interest to sales in Salesforce.",
      "refs": [
        "skello-app-front",
        "svc-billing-automation",
        "cu-up-upsell-manager",
        "dynamo-billing"
      ]
    },
    {
      "title": "The subscription changes",
      "summary": "Chargebee holds the subscription; billing's step functions process each change, churn included.",
      "refs": [
        "cu-up-chargebee-manager",
        "cu-up-lifecycle-handler"
      ]
    },
    {
      "title": "Provisioning starts from the quote",
      "summary": "A contract change starts the provisioning state machine, which first reads the quote from Salesforce.",
      "refs": [
        "sm-contract-change",
        "cu-up-sfn-quote"
      ]
    },
    {
      "title": "The plan's features are loaded",
      "summary": "In a parallel initialisation the plan's features come from svc-modularisation; a failure there is notified on its own.",
      "refs": [
        "smc-init",
        "cu-up-sfn-features",
        "smc-features-error"
      ]
    },
    {
      "title": "Organisation and shops are updated",
      "summary": "Two steps upsert the organisation and its shops in skello-app through SkelloManager.",
      "refs": [
        "cu-up-sfn-org",
        "cu-up-sfn-shops",
        "cu-up-skello-manager"
      ]
    },
    {
      "title": "skello-app gets the new state",
      "summary": "Billing writes organisation, shop and license changes, and churn deletions, back into skello-app.",
      "refs": [
        "cu-up-skello-manager",
        "skello-app",
        "cu-up-mono-api",
        "pg-skello-billing"
      ]
    },
    {
      "title": "Join and Salesforce are told",
      "summary": "The machine pushes the Join setup, then validates the change back to Salesforce.",
      "refs": [
        "cu-up-sfn-join",
        "cu-up-sfn-salesforce"
      ]
    },
    {
      "title": "The client is pinged and emailed",
      "summary": "A final step pings the browser over the legacy websockets, and emails go out through svc-communications-v2.",
      "refs": [
        "smc-notify",
        "cu-up-ws-job",
        "svc-websockets"
      ]
    },
    {
      "title": "Failures notify Salesforce",
      "summary": "A failing step hands over to the notification step, which reports the error to Salesforce and the client.",
      "refs": [
        "cu-up-sfn-error"
      ]
    }
  ],
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
    },
    {
      "id": "cu-up-sfn-quote",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnGetQuoteByIdJobHandler",
      "path": "src/Handler/Job/Event/SfnGetQuoteByIdJobHandler.ts",
      "description": "First provisioning step: reads the quote from Salesforce"
    },
    {
      "id": "cu-up-sfn-features",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnGetFeaturesJobHandler",
      "path": "src/Handler/Job/Event/SfnGetFeaturesJobHandler.ts",
      "description": "Initialisation branch: loads the features the plan grants, from svc-modularisation"
    },
    {
      "id": "cu-up-sfn-org",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnContractChangeUpsertOrganisationJobHandler",
      "path": "src/Handler/Job/Event/SfnContractChangeUpsertOrganisationJobHandler.ts",
      "description": "Upserts the organisation in skello-app through SkelloManager"
    },
    {
      "id": "cu-up-sfn-shops",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnContractChangeUpsertShopsJobHandler",
      "path": "src/Handler/Job/Event/SfnContractChangeUpsertShopsJobHandler.ts",
      "description": "Upserts the shops in skello-app through SkelloManager"
    },
    {
      "id": "cu-up-sfn-join",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnPushJoinSetupJobHandler",
      "path": "src/Handler/Job/Event/SfnPushJoinSetupJobHandler.ts",
      "description": "Pushes the Join setup for the organisation (fire and forget, no retry or catch)"
    },
    {
      "id": "cu-up-sfn-salesforce",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnValidationSalesforceJobHandler",
      "path": "src/Handler/Job/Event/SfnValidationSalesforceJobHandler.ts",
      "description": "Validates the change back to Salesforce"
    },
    {
      "id": "cu-up-sfn-error",
      "service": "svc-billing-automation",
      "kind": "job",
      "label": "SfnNotificationErrorJobHandler",
      "path": "src/Handler/Job/Event/SfnNotificationErrorJobHandler.ts",
      "description": "Notifies Salesforce and pings the client when a provisioning step fails"
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
      "crud": [
        "create",
        "update"
      ]
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
      "crud": [
        "update",
        "delete"
      ]
    },
    {
      "from": "svc-billing-automation",
      "to": "sm-contract-change",
      "label": "start contract change (POST /organisations/start_contract_change)",
      "mode": "async-job"
    },
    {
      "from": "cu-up-sfn-org",
      "to": "cu-up-skello-manager",
      "label": "apply contract change",
      "mode": "sync"
    },
    {
      "from": "cu-up-sfn-shops",
      "to": "cu-up-skello-manager",
      "label": "apply contract change",
      "mode": "sync"
    }
  ],
  "stateMachines": [
    {
      "id": "sm-contract-change",
      "service": "svc-billing-automation",
      "machine": "ContractChangeProvisioningStepFunction",
      "label": "contract-change provisioning",
      "file": "serverless/step-function/provisioning-sfn/contract-change-provisioning-sfn.ts",
      "start": "smc-quote",
      "errorHandler": "smc-error",
      "states": [
        {
          "id": "smc-quote",
          "name": "sfnGetQuoteById",
          "type": "task",
          "label": "get quote",
          "unit": "cu-up-sfn-quote",
          "catches": true,
          "next": "smc-init"
        },
        {
          "id": "smc-init",
          "name": "sfnInitialisation",
          "type": "parallel",
          "label": "initialisation",
          "branches": [
            "smc-features"
          ],
          "next": "smc-org",
          "states": [
            {
              "id": "smc-features",
              "name": "sfnGetFeatures",
              "type": "task",
              "label": "get features",
              "unit": "cu-up-sfn-features",
              "catches": true,
              "catchTo": "smc-features-error"
            },
            {
              "id": "smc-features-error",
              "name": "sfnGetFeaturesNotificationError",
              "type": "task",
              "label": "notify features error"
            }
          ]
        },
        {
          "id": "smc-org",
          "name": "sfnContractChangeUpsertOrganisation",
          "type": "task",
          "label": "upsert organisation",
          "unit": "cu-up-sfn-org",
          "catches": true,
          "next": "smc-shops"
        },
        {
          "id": "smc-shops",
          "name": "sfnContractChangeUpsertShops",
          "type": "task",
          "label": "upsert shops",
          "unit": "cu-up-sfn-shops",
          "catches": true,
          "next": "smc-join"
        },
        {
          "id": "smc-join",
          "name": "sfnPushJoinSetup",
          "type": "task",
          "label": "push Join setup",
          "unit": "cu-up-sfn-join",
          "next": "smc-salesforce"
        },
        {
          "id": "smc-salesforce",
          "name": "sfnValidationSalesforce",
          "type": "task",
          "label": "Salesforce validation",
          "unit": "cu-up-sfn-salesforce",
          "catches": true,
          "next": "smc-notify"
        },
        {
          "id": "smc-notify",
          "name": "sfnNotifyUser",
          "type": "parallel",
          "label": "notify user",
          "branches": [
            "smc-ws"
          ],
          "states": [
            {
              "id": "smc-ws",
              "name": "sfnPushWebsocket",
              "type": "task",
              "label": "push websocket",
              "unit": "cu-up-ws-job"
            }
          ]
        },
        {
          "id": "smc-error",
          "name": "sfnNotificationError",
          "type": "task",
          "label": "notify error",
          "unit": "cu-up-sfn-error"
        }
      ]
    }
  ],
  "infraNodes": [
    {
      "id": "dynamo-billing",
      "type": "dynamodb",
      "label": "svcBillingAutomation-{env}",
      "resources": [
        "ddb:svcBillingAutomation"
      ],
      "description": "Billing service state — upsell requests, subscription mirror, credit balances"
    },
    {
      "id": "pg-skello-billing",
      "type": "postgresql",
      "label": "skello_production — organisations, licenses, shops",
      "resources": [
        "pg:skello_production.organisations",
        "pg:skello_production.licenses",
        "pg:skello_production.shops"
      ],
      "description": "Monolith state updated by billing's write-backs"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-billing-automation",
      "to": "dynamo-billing",
      "label": "billing state",
      "crud": [
        "create",
        "update"
      ]
    },
    {
      "from": "skello-app",
      "to": "pg-skello-billing",
      "label": "apply license changes",
      "crud": [
        "update"
      ]
    }
  ]
})

export default subscription_upgrade
