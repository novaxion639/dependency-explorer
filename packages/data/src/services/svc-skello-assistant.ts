import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_skello_assistant: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-skello-assistant",
  "type": "typescript-microservice",
  "description": "AI assistant orchestrator — routes user queries to appropriate AI capabilities",
  "endpoints": [
    {
      "id": "api-chat",
      "path": "/chat",
      "method": "POST",
      "description": "Send a chat message to the Skello assistant",
      "useCase": "Used by calling services to send a chat message to the Skello assistant",
      "params": [
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "201": "Created",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-skello-assistant"
        }
      ]
    },
    {
      "id": "api-conversation-feedback",
      "path": "/conversation/{id}/feedback",
      "method": "POST",
      "description": "Submit feedback on a conversation",
      "useCase": "Used by calling services to submit feedback on a conversation",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "id identifier"
        },
        {
          "name": "body",
          "in": "body",
          "type": "object",
          "required": true,
          "description": "Request payload"
        }
      ],
      "response": {
        "201": "Created",
        "400": "Validation error"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-skello-assistant"
        }
      ]
    },
    {
      "id": "api-chat-download",
      "path": "/chat/download",
      "method": "GET",
      "description": "Download chat conversation export",
      "useCase": "Used by calling services to download chat conversation export",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-skello-assistant"
        }
      ]
    },
    {
      "id": "api-chat-conversations",
      "path": "/chat/conversations",
      "method": "GET",
      "description": "Get chat conversations list",
      "useCase": "Used by calling services to get chat conversations list",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "mongodb",
          "name": "svc-skello-assistant"
        }
      ]
    },
    {
      "id": "download-message-source-json",
      "path": "/chat/download/json",
      "method": "GET",
      "description": "Download conversation results as JSON (React agent)",
      "useCase": "",
      "params": [],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-skello-assistant",
      "description": "LangGraph conversation state checkpoints (MongoDB)"
    }
  ]
})

export default svc_skello_assistant
