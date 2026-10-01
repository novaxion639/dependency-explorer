import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. IMPORTANT correction over the old
// inventory sketch: the monolith's v3/api/webhooks surface is INBOUND-only —
// no customer-configured outbound webhook system exists anywhere in deployed
// monolith code (no subscription model, no delivery client, no retry jobs).
const inbound_webhooks: ServiceFlow = ServiceFlowSchema.parse({
  "id": "inbound-webhooks",
  "name": "Inbound Webhooks (Salesforce & Zapier)",
  "description": "Third parties POST into the monolith's v3/api/webhooks namespace — the platform's only webhook surface (INBOUND; no outbound webhook subscription/delivery system exists in deployed code). Salesforce sends SOAP/XML notifications to cancel a shop or link a coach: token-authenticated against ENV SALESFORCE_TOKEN, parsed synchronously, Shop updated, fixed <Ack>true</Ack> XML returned. Zapier posts demo-form requests: Bearer-authenticated against ENV ZAPIER_DEMO_TOKEN, a User email lookup returns the account status. Both controllers inherit ActionController::Base directly (outside the app's session auth) and are fully synchronous — no jobs enqueued.",
  "trigger": { "actor": "system", "role": "Salesforce (SOAP notifications) / Zapier (demo form)" },
  "steps": [
    {
      "from": "skello-app (webhooks)",
      "to": "skello-app",
      "action": "POST /v3/api/webhooks/shops/{cancel,link_coach} (Salesforce SOAP) · POST /v3/api/webhooks/demo_requests (Zapier)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-iw-salesforce",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Webhooks::SalesforceController",
      "path": "app/controllers/v3/api/webhooks/salesforce_controller.rb",
      "description": "cancel_shop / link_coach — parses the SOAP Notification XML (InvalidParams on parse failure), updates the Shop, answers <Ack>true</Ack>"
    },
    {
      "id": "cu-iw-demo",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Webhooks::DemoRequestsController",
      "path": "app/controllers/v3/api/webhooks/demo_requests_controller.rb",
      "description": "Demo-form email lookup — returns the account status string"
    },
    {
      "id": "cu-iw-cancel-service",
      "service": "skello-app",
      "kind": "service",
      "label": "Shops::CancellationCreateService",
      "path": "app/services/shops/cancellation_create_service.rb",
      "description": "Applies the cancellation date to the Shop (change_cancellation!)"
    }
  ],
  "codeEdges": [
    { "from": "skello-app", "to": "cu-iw-salesforce", "label": "SOAP cancel_shop / link_coach", "mode": "sync" },
    { "from": "skello-app", "to": "cu-iw-demo", "label": "demo_requests", "mode": "sync" },
    {
      "from": "cu-iw-salesforce", "to": "cu-iw-cancel-service", "label": "CancellationCreateService.change_cancellation!",
      "mode": "sync", "condition": "cancel_shop notification", "crud": ["update"]
    },
    {
      "from": "cu-iw-salesforce", "to": "pg-skello-webhooks", "label": "Shop.update! coach",
      "mode": "sync", "condition": "link_coach notification", "crud": ["update"]
    },
    { "from": "cu-iw-demo", "to": "pg-skello-webhooks", "label": "User.find_by(email)", "mode": "sync", "crud": ["read"] }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-webhooks",
      "type": "postgresql",
      "label": "skello_production — shops, users",
      "description": "Shop cancellation/coach updates + demo-request user lookups"
    }
  ],
  "infraEdges": [
    { "from": "skello-app", "to": "pg-skello-webhooks", "label": "shop updates + user reads", "crud": ["read", "update"] }
  ]
})

export default inbound_webhooks
