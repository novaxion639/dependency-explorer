import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const svc_communications_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-communications-v2",
  "type": "typescript-microservice",
  "description": "Centralised multi-channel messaging — email, SMS, push notifications and in-app messages",
  "endpoints": [
    {
      "id": "bulk-create-high-priority-notification-route",
      "path": "/notifications/high-priority",
      "method": "POST",
      "description": "Bulk create high priority push notifications (SQS integration)",
      "useCase": "Used by calling services to bulk create high priority push notifications (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "bulk-create-low-priority-notification-route",
      "path": "/notifications/low-priority",
      "method": "POST",
      "description": "Bulk create low priority push notifications (SQS integration)",
      "useCase": "Used by calling services to bulk create low priority push notifications (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "bulk-create-high-priority-email-route",
      "path": "/email/high-priority",
      "method": "POST",
      "description": "Bulk create high priority emails (SQS integration)",
      "useCase": "Used by calling services to bulk create high priority emails (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "bulk-create-low-priority-email-route",
      "path": "/email/low-priority",
      "method": "POST",
      "description": "Bulk create low priority emails (SQS integration)",
      "useCase": "Used by calling services to bulk create low priority emails (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "bulk-create-high-priority-sms-route",
      "path": "/sms/high-priority",
      "method": "POST",
      "description": "Bulk create high priority SMS (SQS integration)",
      "useCase": "Used by calling services to bulk create high priority SMS (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "bulk-create-low-priority-sms-route",
      "path": "/sms/low-priority",
      "method": "POST",
      "description": "Bulk create low priority SMS (SQS integration)",
      "useCase": "Used by calling services to bulk create low priority SMS (SQS integration)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    },
    {
      "id": "callback-sms-mode-route",
      "path": "/${self:custom.parameters.smsModeCallbackPath}",
      "method": "POST",
      "description": "SMS Mode callback webhook (dynamic path from config)",
      "useCase": "Used by calling services to sMS Mode callback webhook (dynamic path from config)",
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
          "name": "svcCommunicationsV2-{env}"
        },
        {
          "type": "s3",
          "name": "svc-communications-v2.attachments.{env}"
        },
        {
          "type": "sqs",
          "name": "email-high / email-low"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcCommunicationsV2-{env}",
      "description": "Notification records and delivery state"
    },
    {
      "type": "sqs",
      "name": "email-high / email-low",
      "description": "Priority-tiered email dispatch queues"
    },
    {
      "type": "s3",
      "name": "svc-communications-v2.attachments.{env}",
      "description": "Email attachment storage"
    }
  ]
})

export default svc_communications_v2
