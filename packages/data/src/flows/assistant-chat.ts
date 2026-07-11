import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Authored 2026-06-15 from the flow inventory (candidate #1). Every service
// edge was code-verified during the 2026-06 assistant investigation; the code
// layer is traced from svc-skello-assistant source (ChatController →
// ChatSessionManager → AgentManager → agent tools).
const assistant_chat: ServiceFlow = ServiceFlowSchema.parse({
  "id": "assistant-chat",
  "name": "AI Assistant Chat Turn",
  "description": "A manager asks the Skello AI assistant a question. The chat session manager gates the turn on the organisation's freemium credit balance (svc-billing-automation), then the LangGraph agent runs on Bedrock Converse (or direct Anthropic behind a flag) with conversation state checkpointed in svc-intelligence's MongoDB ('for continuity'). Agent tools fan out to real data: shift/worked-hours tools call svc-shifts over HTTP (MCP), document tools read svc-documents-v2 and poll e-signature status on the decommission-watch service, and employee tools read svc-search's employees replica directly over VPC Mongo. A credit is consumed after a successful turn.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-skello-assistant",
      "action": "Chat turn (base-app svcSkelloAssistant client — ProcessChatDto)"
    },
    {
      "from": "svc-skello-assistant",
      "to": "svc-billing-automation",
      "action": "GET /credit-balance/{organisationId}/{featureKey} — freemium gate before the turn (featureKey ai_agent); POST /credit-balance/{organisationId}/{featureKey}/use after a successful turn"
    },
    {
      "from": "svc-skello-assistant",
      "to": "svc-shifts",
      "action": "MCP shift/absence/worked-hours tools (SvcShiftsClient — SVC_SHIFTS_URI, API key)"
    },
    {
      "from": "svc-skello-assistant",
      "to": "svc-documents-v2",
      "action": "Document tools read employee documents (svc-documents-v2-client)"
    },
    {
      "from": "svc-skello-assistant",
      "to": "svc-documents-esignature",
      "action": "Contract tools poll e-signature status (DocumentsStatusDto) — live caller on the decommission-watch service"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-chat-controller",
      "service": "svc-skello-assistant",
      "kind": "controller",
      "label": "ChatController / ProcessChatController",
      "path": "serverless/src/agent/Controller/ChatController.ts",
      "description": "Chat entry points — delegate the turn to ChatSessionManager"
    },
    {
      "id": "cu-session-manager",
      "service": "svc-skello-assistant",
      "kind": "manager",
      "label": "ChatSessionManager",
      "path": "serverless/src/agent/Manager/ChatSessionManager.ts",
      "description": "Session orchestration: credit-balance gate before the turn, agent invocation, credit consumption after success, conversation persistence"
    },
    {
      "id": "cu-billing-client",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "BillingAutomationClient",
      "path": "serverless/src/agent/Client/BillingAutomationClient.ts",
      "description": "getCreditBalanceWithApiKey / useCredit, featureKey 'ai_agent' (SVC_BILLING_AUTOMATION_API_URL + API key)"
    },
    {
      "id": "cu-agent-manager",
      "service": "svc-skello-assistant",
      "kind": "manager",
      "label": "AgentManager",
      "path": "serverless/src/agent/Manager/AgentManager.ts",
      "description": "Runs the LangGraph agent — model from Client/model.ts (ChatBedrockConverse on eu-west-1, or direct Anthropic behind useDirectAnthropic), checkpoints via mongoCheckpointer, welcome middleware before the model call"
    },
    {
      "id": "cu-agent-tools",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "Agent tools (MCP + repositories)",
      "description": "The tool belt the agent can call during a turn — wired in tools/container.ts and the mcp-server package"
    },
    {
      "id": "cu-doc-repo",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "tools DocumentRepository",
      "path": "serverless/src/tools/Repository/Http/DocumentRepository.ts",
      "description": "Reads employee documents through @skelloapp/svc-documents-v2-client"
    },
    {
      "id": "cu-esign-repo",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "tools DocumentEsignaturesRepository",
      "path": "serverless/src/tools/Repository/Http/DocumentEsignaturesRepository.ts",
      "description": "Polls e-signature status through @skelloapp/svc-esignature-sdk"
    },
    {
      "id": "cu-employee-repo",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "tools Mongo EmployeeRepository",
      "path": "serverless/src/tools/Repository/Mongo/Agents/EmployeeRepository.ts",
      "description": "Reads the employees replica collection from svc-search's shared MongoDB (dedicated connection, MONGO_DB_SVC_SEARCH_URI; EmployeeEntityAttributes as the contract)"
    },
    {
      "id": "cu-shifts-client",
      "service": "svc-skello-assistant",
      "kind": "service",
      "label": "mcp-server SvcShiftsClient",
      "path": "mcp-server/src/clients/SvcShiftsClient.ts",
      "description": "HTTP client for shift/absence/worked-hours tools (GetEmployeesForShifts, ShiftDetails; SVC_SHIFTS_URI + API key)"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-chat-controller",
      "label": "chat turn",
      "mode": "sync"
    },
    {
      "from": "cu-chat-controller",
      "to": "cu-session-manager",
      "label": "process turn",
      "mode": "sync"
    },
    {
      "from": "cu-session-manager",
      "to": "cu-billing-client",
      "label": "credit gate (before) + useCredit (after success)",
      "mode": "sync"
    },
    {
      "from": "cu-billing-client",
      "to": "svc-billing-automation",
      "label": "GET credit-balance / POST use",
      "mode": "sync"
    },
    {
      "from": "cu-session-manager",
      "to": "cu-agent-manager",
      "label": "run agent",
      "mode": "sync",
      "condition": "credits available"
    },
    {
      "from": "cu-agent-manager",
      "to": "mongo-svc-int",
      "label": "LangGraph checkpoints + conversations (TTL 1 week)",
      "mode": "sync",
      "crud": ["create", "read", "update"]
    },
    {
      "from": "cu-agent-manager",
      "to": "cu-agent-tools",
      "label": "tool calls during the turn",
      "mode": "sync"
    },
    {
      "from": "cu-agent-tools",
      "to": "cu-shifts-client",
      "label": "shift / worked-hours questions",
      "mode": "sync"
    },
    {
      "from": "cu-shifts-client",
      "to": "svc-shifts",
      "label": "GetEmployeesForShifts / ShiftDetails",
      "mode": "sync"
    },
    {
      "from": "cu-agent-tools",
      "to": "cu-doc-repo",
      "label": "document questions",
      "mode": "sync"
    },
    {
      "from": "cu-doc-repo",
      "to": "svc-documents-v2",
      "label": "read employee documents",
      "mode": "sync"
    },
    {
      "from": "cu-agent-tools",
      "to": "cu-esign-repo",
      "label": "contract signature status",
      "mode": "sync"
    },
    {
      "from": "cu-esign-repo",
      "to": "svc-documents-esignature",
      "label": "poll signature status",
      "mode": "sync"
    },
    {
      "from": "cu-agent-tools",
      "to": "cu-employee-repo",
      "label": "employee questions",
      "mode": "sync"
    },
    {
      "from": "cu-employee-repo",
      "to": "svc-search",
      "label": "read employees replica (Mongo over VPC)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-svc-int",
      "type": "mongodb",
      "label": "svc-intelligence MongoDB (shared)",
      "description": "Conversations, LangGraph checkpoints and checkpoint_writes with 1-week TTL — 'FOR continuity we keep using svc int mongo db' (MongooseInstance.ts). A shared-store coupling, modelled as the svc-skello-assistant → svc-intelligence mongodb connection."
    }
  ],
  "infraEdges": [
    {
      "from": "svc-skello-assistant",
      "to": "mongo-svc-int",
      "label": "conversations + checkpoints",
      "crud": ["create", "read", "update"]
    }
  ]
})

export default assistant_chat
