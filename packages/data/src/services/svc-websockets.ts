import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_websockets: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-websockets",
  "type": "typescript-microservice",
  "description": "LEGACY real-time WebSocket service, superseded by svc-websockets-v2 but still live: svc-intelligence pushes through its websocket-genericMessage queue and svc-billing-automation through its websocket-pingTypeAndUuid queue (verified 2026-06-10 in both producers' serverless config — neither queue belongs to v2, whose only ingestion queue is websocket-topicMessage). Repo not checked out locally; endpoints and storage not mapped. Producers must migrate to v2 before this can be decommissioned.",
  "tags": ["decommission-watch"],
  "endpoints": [],
  "databases": [
    {
      "type": "sqs",
      "name": "websocket-genericMessage",
      "description": "Ingestion queue used by svc-intelligence (WEBSOCKET_GENERIC_SQS_URL)"
    },
    {
      "type": "sqs",
      "name": "websocket-pingTypeAndUuid",
      "description": "Ingestion queue used by svc-billing-automation step functions (WEBSOCKET_SQS_URL)"
    }
  ]
})

export default svc_websockets
