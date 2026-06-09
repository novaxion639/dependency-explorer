import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_intelligence: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-intelligence",
  "type": "typescript-microservice",
  "description": "AI-powered analysis layer — OpenAI integration for document processing and assistant features",
  "endpoints": [
    {
      "id": "api-validate-llm-response",
      "path": "/validate-llm-response",
      "method": "POST",
      "description": "Validate LLM response",
      "useCase": "Used by calling services to validate LLM response",
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
          "name": "svcIntelligence-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-intelligence"
        },
        {
          "type": "s3",
          "name": "svc-intelligence.{env}"
        }
      ]
    },
    {
      "id": "api-create-validation-response",
      "path": "/validation-responses",
      "method": "POST",
      "description": "Create validation response",
      "useCase": "Used by calling services to create validation response",
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
          "name": "svcIntelligence-{env}"
        },
        {
          "type": "mongodb",
          "name": "svc-intelligence"
        },
        {
          "type": "s3",
          "name": "svc-intelligence.{env}"
        }
      ]
    },
    {
      "id": "api-request-analysis",
      "path": "/analyse/{documentId}",
      "method": "POST",
      "description": "Request analysis of a document",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "trigger-dynamo-scan",
      "path": "/dynamoScan",
      "method": "GET",
      "description": "Scan the DynamoDB",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "get-validation-response",
      "path": "/validationResponses/{documentId}",
      "method": "GET",
      "description": "Get validation response",
      "useCase": "",
      "params": [
        {
          "name": "documentId",
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
      "name": "svcIntelligence-{env}",
      "description": "AI model inference cache and prediction results"
    },
    {
      "type": "mongodb",
      "name": "svc-intelligence",
      "description": "Historical workforce data for model training"
    },
    {
      "type": "s3",
      "name": "svc-intelligence.{env}",
      "description": "Model artefacts and training datasets"
    },
    {
      "type": "sqs",
      "name": "svc-intelligence-dlq",
      "description": "Failed inference job retry queue"
    }
  ]
})

export default svc_intelligence
