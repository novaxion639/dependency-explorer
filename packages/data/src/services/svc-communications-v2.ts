import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_communications_v2: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-communications-v2",
  "type": "typescript-microservice",
  "description": "Centralised multi-channel messaging — email, SMS, push notifications and in-app messages",
  "endpoints": [
    {
      "id": "api-create-device-token",
      "path": "/push-notifications/token",
      "method": "POST",
      "description": "Create a new notification token",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-delete-device-token",
      "path": "/push-notifications/token/{token}",
      "method": "DELETE",
      "description": "Delete a device token",
      "useCase": "",
      "params": [
        {
          "name": "token",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-find-one-blacklisted-phone",
      "path": "/blacklisted-phone/{phone}",
      "method": "GET",
      "description": "Find one blacklisted phone",
      "useCase": "",
      "params": [
        {
          "name": "phone",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-find-one-blacklisted-email",
      "path": "/blacklisted-email/{email}",
      "method": "GET",
      "description": "Find one blacklisted email",
      "useCase": "",
      "params": [
        {
          "name": "email",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-delete-blacklisted-phone",
      "path": "/blacklisted-phone/{phone}",
      "method": "DELETE",
      "description": "Delete a blacklisted phone",
      "useCase": "",
      "params": [
        {
          "name": "phone",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-delete-blacklisted-email",
      "path": "/blacklisted-email/{email}",
      "method": "DELETE",
      "description": "Delete a blacklisted email",
      "useCase": "",
      "params": [
        {
          "name": "email",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-email-display",
      "path": "/email-display/{emailId}",
      "method": "GET",
      "description": "Display email content for SuperAdmin",
      "useCase": "",
      "params": [
        {
          "name": "emailId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-send-test-email",
      "path": "/emails/test",
      "method": "POST",
      "description": "Send a test email",
      "useCase": "",
      "params": [],
      "response": {}
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
