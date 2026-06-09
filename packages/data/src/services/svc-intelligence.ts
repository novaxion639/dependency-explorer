import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_intelligence: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-intelligence",
  "type": "typescript-microservice",
  "description": "AI-powered analysis layer — OpenAI integration for document processing and assistant features",
  "endpoints": [
    {
      "id": "api-analyse",
      "path": "/analyse",
      "method": "POST",
      "description": "Analyse data with AI/intelligence",
      "useCase": "Used by calling services to analyse data with AI/intelligence",
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
      "id": "api-dynamo-scan",
      "path": "/dynamo-scan",
      "method": "POST",
      "description": "Scan DynamoDB for intelligence data",
      "useCase": "Used by calling services to scan DynamoDB for intelligence data",
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
      "id": "api-get-validation-responses",
      "path": "/validation-responses",
      "method": "GET",
      "description": "Get validation responses",
      "useCase": "Used by calling services to get validation responses",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
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
