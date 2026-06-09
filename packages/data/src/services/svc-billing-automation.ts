import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_billing_automation: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-billing-automation",
  "type": "typescript-microservice",
  "description": "Subscription billing and invoice automation via Stripe",
  "endpoints": [
    {
      "id": "api-get-quote",
      "path": "/quotes/{quoteId}",
      "method": "GET",
      "description": "Get a quote by ID",
      "useCase": "Used by calling services to get a quote by ID",
      "params": [
        {
          "name": "quoteId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "quoteId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-quote",
      "path": "/quotes",
      "method": "POST",
      "description": "Create a quote",
      "useCase": "Used by calling services to create a quote",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-quote",
      "path": "/quotes/{quoteId}",
      "method": "PATCH",
      "description": "Update a quote",
      "useCase": "Used by calling services to update a quote",
      "params": [
        {
          "name": "quoteId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "quoteId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-create-checkout-session",
      "path": "/checkout/sessions",
      "method": "POST",
      "description": "Create a checkout session",
      "useCase": "Used by calling services to create a checkout session",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-create-portal-session",
      "path": "/portal/sessions",
      "method": "POST",
      "description": "Create a billing portal session",
      "useCase": "Used by calling services to create a billing portal session",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-organisation",
      "path": "/organisations/{organisationId}",
      "method": "GET",
      "description": "Get organisation billing info",
      "useCase": "Used by calling services to get organisation billing info",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "organisationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-organisation",
      "path": "/organisations",
      "method": "POST",
      "description": "Create organisation for billing",
      "useCase": "Used by calling services to create organisation for billing",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-organisation",
      "path": "/organisations/{organisationId}",
      "method": "PATCH",
      "description": "Update organisation billing info",
      "useCase": "Used by calling services to update organisation billing info",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "organisationId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-shop",
      "path": "/shops/{shopId}",
      "method": "GET",
      "description": "Get shop billing info",
      "useCase": "Used by calling services to get shop billing info",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-shop",
      "path": "/shops",
      "method": "POST",
      "description": "Create shop for billing",
      "useCase": "Used by calling services to create shop for billing",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-shop",
      "path": "/shops/{shopId}",
      "method": "PATCH",
      "description": "Update shop billing info",
      "useCase": "Used by calling services to update shop billing info",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "shopId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-chargebee-source",
      "path": "/chargebee/sources/{sourceId}",
      "method": "GET",
      "description": "Get Chargebee payment source",
      "useCase": "Used by calling services to get Chargebee payment source",
      "params": [
        {
          "name": "sourceId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "sourceId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-chargebee-source",
      "path": "/chargebee/sources",
      "method": "POST",
      "description": "Create Chargebee payment source",
      "useCase": "Used by calling services to create Chargebee payment source",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-delete-chargebee-source",
      "path": "/chargebee/sources/{sourceId}",
      "method": "DELETE",
      "description": "Delete Chargebee payment source",
      "useCase": "Used by calling services to delete Chargebee payment source",
      "params": [
        {
          "name": "sourceId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "sourceId identifier"
        }
      ],
      "response": {
        "204": "Deleted",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-chargebee-contact",
      "path": "/chargebee/contacts/{contactId}",
      "method": "GET",
      "description": "Get Chargebee contact",
      "useCase": "Used by calling services to get Chargebee contact",
      "params": [
        {
          "name": "contactId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "contactId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-chargebee-contact",
      "path": "/chargebee/contacts",
      "method": "POST",
      "description": "Create Chargebee contact",
      "useCase": "Used by calling services to create Chargebee contact",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-chargebee-contact",
      "path": "/chargebee/contacts/{contactId}",
      "method": "PATCH",
      "description": "Update Chargebee contact",
      "useCase": "Used by calling services to update Chargebee contact",
      "params": [
        {
          "name": "contactId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "contactId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-billing",
      "path": "/billing/{billingId}",
      "method": "GET",
      "description": "Get billing record",
      "useCase": "Used by calling services to get billing record",
      "params": [
        {
          "name": "billingId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "billingId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-billing",
      "path": "/billing",
      "method": "POST",
      "description": "Create billing record",
      "useCase": "Used by calling services to create billing record",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-billing",
      "path": "/billing/{billingId}",
      "method": "PATCH",
      "description": "Update billing record",
      "useCase": "Used by calling services to update billing record",
      "params": [
        {
          "name": "billingId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "billingId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-self-serve",
      "path": "/self-serve/{selfServeId}",
      "method": "GET",
      "description": "Get self-serve record",
      "useCase": "Used by calling services to get self-serve record",
      "params": [
        {
          "name": "selfServeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "selfServeId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-self-serve",
      "path": "/self-serve",
      "method": "POST",
      "description": "Create self-serve record",
      "useCase": "Used by calling services to create self-serve record",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-update-self-serve",
      "path": "/self-serve/{selfServeId}",
      "method": "PATCH",
      "description": "Update self-serve record",
      "useCase": "Used by calling services to update self-serve record",
      "params": [
        {
          "name": "selfServeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "selfServeId identifier"
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
        "200": "Updated",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-company-registration",
      "path": "/company-registrations/{registrationId}",
      "method": "GET",
      "description": "Get company registration",
      "useCase": "Used by calling services to get company registration",
      "params": [
        {
          "name": "registrationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": "registrationId identifier"
        }
      ],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-create-company-registration",
      "path": "/company-registrations",
      "method": "POST",
      "description": "Create company registration",
      "useCase": "Used by calling services to create company registration",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    },
    {
      "id": "api-get-pricing",
      "path": "/pricing",
      "method": "GET",
      "description": "Get pricing information",
      "useCase": "Used by calling services to get pricing information",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-get-credit-balance",
      "path": "/credit-balance",
      "method": "GET",
      "description": "Get credit balance",
      "useCase": "Used by calling services to get credit balance",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        }
      ]
    },
    {
      "id": "api-add-credit-balance",
      "path": "/credit-balance",
      "method": "POST",
      "description": "Add credit balance",
      "useCase": "Used by calling services to add credit balance",
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
          "name": "svcBillingAutomation-{env}"
        },
        {
          "type": "s3",
          "name": "svc-billing-automation.{env}"
        },
        {
          "type": "sns",
          "name": "svc-billing-automation-sns"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcBillingAutomation-{env}",
      "description": "Subscription quotes, contracts and billing state"
    },
    {
      "type": "s3",
      "name": "svc-billing-automation.{env}",
      "description": "Contract documents and export files"
    },
    {
      "type": "sqs",
      "name": "svc-billing-automation-dlq",
      "description": "Failed billing event retry queue"
    },
    {
      "type": "sns",
      "name": "svc-billing-automation-sns",
      "description": "Contract lifecycle change notifications"
    }
  ]
})

export default svc_billing_automation
