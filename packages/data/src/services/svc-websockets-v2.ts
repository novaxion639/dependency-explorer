import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_websockets_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-websockets-v2",
  "type": "typescript-microservice",
  "description": "Real-time WebSocket service for Skello's frontends — manages the full connection lifecycle (authentication at $connect, topic-based pub/sub, message persistence, history replay on reconnect) on AWS API Gateway WebSocket API. Has no HTTP endpoints: services push messages by sending SDK TopicMessageModel payloads to the websocket-topicMessage SQS queue, which the service fans out to subscribed connections.",
  "endpoints": [],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcWebsocketsV2 (single-table)",
      "description": "Connections, topic subscriptions and persisted messages for history replay"
    },
    {
      "type": "sqs",
      "name": "websocket-topicMessage",
      "description": "Ingestion queue — producer services enqueue TopicMessageModel payloads (DLQ: websocket-topicMessageDlq)"
    }
  ]
})

export default svc_websockets_v2
