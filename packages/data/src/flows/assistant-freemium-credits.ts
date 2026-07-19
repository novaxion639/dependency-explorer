import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. The credit gate wrapping every
// assistant chat turn — check-before, decrement-after.
const assistant_freemium_credits: ServiceFlow = ServiceFlowSchema.parse({
  "id": "assistant-freemium-credits",
  "name": "Assistant Freemium Credits",
  "description": "Every assistant chat turn passes a credit gate. Check-before: ChatSessionManager.discuss synchronously reads the balance (GET credit-balance) before enqueuing the turn — refusing with TooManyRequestsHttpError('Not enough credits') only when used EXCEEDS limit, so the last credit tolerates one overshoot. Decrement-after: once the LLM turn completes in the SQS consumer, useCredit fires best-effort — errors are LOGGED, NOT retried (a code-noted credit-loss risk), and no idempotency guards the decrement against SQS redelivery double-counting. The billing side stores one DynamoDB row per (organisation, feature 'ai_agent', period YYYY-MM): NO refill cron exists — a fresh month lazily creates a zero-used row on first access. Limits are plan-derived (freemium = 5 × admin_count, paid 1000, no-access 0) and re-raise on upgrade only when the org already hit its cap.",
  "trigger": { "actor": "manager", "role": "assistant user (SystemAdminPermissions on discuss)" },
  "links": [
    { "to": "assistant-chat", "kind": "continuation", "note": "the gate wraps assistant-chat's LLM turn — check before the enqueue, decrement after the turn" }
  ],
  "steps": [
    {
      "from": "svc-skello-assistant",
      "to": "svc-billing-automation",
      "action": "GET /credit-balance/{organisationId}/{featureKey} (pre-turn gate) · POST /credit-balance/{organisationId}/{featureKey}/use (post-turn decrement)"
    },
    {
      "from": "svc-billing-automation",
      "to": "skello-app",
      "action": "getOrganisationFeature — plan/freemium + admin_count to derive the credit limit"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-afc-chat-controller",
      "service": "svc-skello-assistant",
      "kind": "controller",
      "label": "ChatController",
      "path": "serverless/src/agent/Controller/ChatController.ts",
      "description": "POST /chat discuss handler — SystemAdminPermissions at the method, JwtOrApiKey at the route"
    },
    {
      "id": "cu-afc-session-mgr",
      "service": "svc-skello-assistant",
      "kind": "manager",
      "label": "ChatSessionManager",
      "path": "serverless/src/agent/Manager/ChatSessionManager.ts",
      "description": "discuss: balance gate then SQS enqueue; process: LLM turn then best-effort decrement (useCredit failure swallowed — logged, not thrown)"
    },
    {
      "id": "cu-afc-process-controller",
      "service": "svc-skello-assistant",
      "kind": "controller",
      "label": "ProcessChatController",
      "path": "serverless/src/agent/Controller/ProcessChatController.ts",
      "description": "processChatSQS consumer — processChatWithMCP per record"
    },
    {
      "id": "cu-afc-agent-mgr",
      "service": "svc-skello-assistant",
      "kind": "manager",
      "label": "AgentManager",
      "path": "serverless/src/agent/Manager/AgentManager.ts",
      "description": "The LangGraph LLM turn (.call)"
    },
    {
      "id": "cu-afc-billing-client",
      "service": "svc-skello-assistant",
      "kind": "client",
      "label": "BillingAutomationClient",
      "path": "serverless/src/agent/Client/BillingAutomationClient.ts",
      "description": "FactoryBillingAutomationWeb wrapper — getCreditBalance + useCredit (featureKey defaults 'ai_agent', apiKey auth)"
    },
    {
      "id": "cu-afc-credit-controller",
      "service": "svc-billing-automation",
      "kind": "controller",
      "label": "CreditBalanceController",
      "path": "src/Controller/CreditBalanceController.ts",
      "description": "getCreditBalance (JWT org check) + useCreditBalance (api-key ONLY — the decrement is service-to-service)"
    },
    {
      "id": "cu-afc-credit-mgr",
      "service": "svc-billing-automation",
      "kind": "manager",
      "label": "CreditBalanceManager",
      "path": "src/Manager/CreditBalanceManager.ts",
      "description": "getOrInitialize + incrementUsed; plan-derived limits (BASE 5×admins / PAID 1000 / NO_ACCESS 0); used>limit only WARNS — one extra consumption tolerated by design"
    },
    {
      "id": "cu-afc-credit-repo",
      "service": "svc-billing-automation",
      "kind": "service",
      "label": "CreditBalanceRepository",
      "path": "src/Repository/CreditBalanceRepository.ts",
      "description": "Dynamo get/put + atomic incrementUsed/updateLimit"
    },
    {
      "id": "cu-afc-skello-repo",
      "service": "svc-billing-automation",
      "kind": "client",
      "label": "SkelloRepository",
      "path": "src/Repository/Skello/SkelloRepository.ts",
      "description": "getOrganisationFeature — shops[].freemium/activated + admin_count for the limit derivation"
    }
  ],
  "codeEdges": [
    { "from": "cu-afc-chat-controller", "to": "cu-afc-session-mgr", "label": "discuss", "mode": "sync" },
    {
      "from": "cu-afc-session-mgr", "to": "cu-afc-billing-client", "label": "getCreditBalance (gate) / useCredit (post-turn, best-effort)",
      "mode": "sync", "condition": "gate refuses only when used > limit (last-credit overshoot tolerated)"
    },
    {
      "from": "cu-afc-billing-client", "to": "svc-billing-automation", "label": "credit-balance read + use",
      "mode": "sync",
      "auth": { "tokenType": "api-key", "authorizer": "SkelloLambdaAuthorizerApiKey" }
    },
    {
      "from": "cu-afc-session-mgr", "to": "sqs-assistant-processchat", "label": "enqueue turn", "mode": "async-job",
      "condition": "availableCredits >= 0", "crud": ["create"],
      "failure": { "queue": "processChatSQS", "dlq": "processChatDLQ", "onError": "A dead-lettered turn is a lost answer; the pre-turn credit was NOT decremented (decrement happens post-turn)" }
    },
    { "from": "sqs-assistant-processchat", "to": "cu-afc-process-controller", "label": "processChatWithMCP", "mode": "async-job" },
    { "from": "cu-afc-process-controller", "to": "cu-afc-session-mgr", "label": "process", "mode": "sync" },
    { "from": "cu-afc-session-mgr", "to": "cu-afc-agent-mgr", "label": "LLM turn (.call)", "mode": "sync" },
    { "from": "svc-billing-automation", "to": "cu-afc-credit-controller", "label": "credit-balance routes", "mode": "sync" },
    { "from": "cu-afc-credit-controller", "to": "cu-afc-credit-mgr", "label": "getOrInitialize / incrementUsed", "mode": "sync" },
    { "from": "cu-afc-credit-mgr", "to": "cu-afc-credit-repo", "label": "atomic Dynamo ops", "mode": "sync", "crud": ["create", "read", "update"] },
    { "from": "cu-afc-credit-mgr", "to": "cu-afc-skello-repo", "label": "plan/admin_count for limit", "mode": "sync", "condition": "on init / upgrade re-check" },
    { "from": "cu-afc-skello-repo", "to": "skello-app", "label": "getOrganisationFeature", "mode": "sync" },
    { "from": "cu-afc-credit-repo", "to": "dynamo-billing-credits", "label": "CREDIT_BALANCE items (period YYYY-MM)", "mode": "sync", "crud": ["create", "read", "update"] }
  ],
  "infraNodes": [
    {
      "id": "sqs-assistant-processchat",
      "type": "sqs",
      "label": "processChatSQS (+ processChatDLQ)",
      "description": "The turn queue between discuss and the LLM consumer"
    },
    {
      "id": "dynamo-billing-credits",
      "type": "dynamodb",
      "label": "svc-billing-automation single-table",
      "description": "PK ORGANISATION#{id}, SK CREDIT_BALANCE#PERIOD_{YYYY-MM}#FEATURE_{key} — used/limit; no refill cron, months lazily initialize"
    }
  ],
  "infraEdges": [
    { "from": "svc-skello-assistant", "to": "sqs-assistant-processchat", "label": "turn enqueue", "crud": ["create"] },
    { "from": "svc-billing-automation", "to": "dynamo-billing-credits", "label": "credit ledger", "crud": ["create", "read", "update"] }
  ]
})

export default assistant_freemium_credits
