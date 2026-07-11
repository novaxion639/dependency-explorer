import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_events: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-events",
  "type": "typescript-microservice",
  "description": "Domain event bus — publishes and routes domain events between services",
  "endpoints": [
    {
      "id": "api-event-create",
      "path": "/events",
      "method": "POST",
      "description": "Create a new event",
      "useCase": "Used by calling services to create a new event",
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
          "type": "dynamodb",
          "name": "svcEvents-{env}"
        },
        {
          "type": "s3",
          "name": "svc-events.{env}"
        }
      ]
    },
    {
      "id": "get-events-api",
      "path": "/events",
      "method": "GET",
      "description": "Get events",
      "useCase": "Used by calling services to get events",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcEvents-{env}"
        },
        {
          "type": "s3",
          "name": "svc-events.{env}"
        }
      ]
    },
    {
      "id": "api-get-activity-logs",
      "path": "/{organisationId}/activity-logs",
      "method": "POST",
      "description": "Reads activity logs",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-trigger-download-activity-logs",
      "path": "/{organisationId}/activity-logs/download",
      "method": "POST",
      "description": "Triggers activity logs CSV download via SQS",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcEvents-{env}",
      "description": "Event records — audit trail of all user actions"
    },
    {
      "type": "s3",
      "name": "svc-events.{env}",
      "description": "Event payload archive"
    }
  ]
})

export default svc_events
