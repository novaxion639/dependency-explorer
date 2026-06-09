import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_billing_automation: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-billing-automation",
  "type": "typescript-microservice",
  "description": "Subscription billing and invoice automation via Stripe",
  "endpoints": [
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
      "path": "/shop/{id}",
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
      "id": "api-create-chargebee-source",
      "path": "/chargebee_sources/{chargebeeId}",
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
      "id": "api-update-chargebee-contact",
      "path": "/chargebee_contacts/{chargebeeCustomerId}/{contactId}",
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
      "id": "api-get-credit-balance",
      "path": "/credit-balance/{organisationId}/{featureKey}",
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
      "id": "api-get-quote-by-id",
      "path": "/quote/{id}",
      "method": "GET",
      "description": "GET /quote/{id}",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-validate-quote",
      "path": "/quote/{id}/validate",
      "method": "PATCH",
      "description": "PATCH /quote/{id}/validate",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-update-quote-billing",
      "path": "/quote/{id}/billing",
      "method": "PATCH",
      "description": "PATCH /quote/{id}/billing",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-update-quote-shop-billing",
      "path": "/quote/{id}/shop/billing",
      "method": "PATCH",
      "description": "PATCH /quote/{id}/shop/billing",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-checkout-by-chargebee-id",
      "path": "/checkout/{chargebeeId}",
      "method": "POST",
      "description": "POST /checkout/{chargebeeId}",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-portal-session-by-c-bee-id",
      "path": "/portal_sessions/{chargebeeId}",
      "method": "POST",
      "description": "Creates a chargebee portal session object from Chargebee ID",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-start-contract-change-provisioning",
      "path": "/organisations/start_contract_change",
      "method": "POST",
      "description": "POST /organisations/start_contract_change",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-chargebee-id-from-sf-by-jwt",
      "path": "/client/organisations/{organisationId}/chargebee_ids",
      "method": "GET",
      "description": "Called from client: Gets the list of chargebee ids for an organisation",
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
      "id": "api-get-chargebee-id-from-sf-by-api-key",
      "path": "/service/organisations/{organisationId}/chargebee_ids",
      "method": "GET",
      "description": "Called from backend service : Gets the list of chargebee ids for an organisation",
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
      "id": "api-get-orga-contract-details",
      "path": "/organisations/{organisationId}/contract_details",
      "method": "GET",
      "description": "Gets the contract details in salesforce for an organisation",
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
      "id": "api-get-chargebee-sources",
      "path": "/chargebee_sources",
      "method": "GET",
      "description": "Lists chargebee payment sources for an array of chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-chargebee-contacts",
      "path": "/chargebee_contacts/{chargebeeCustomerId}",
      "method": "GET",
      "description": "Lists contacts for a chargebee customer",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeCustomerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-add-chargebee-contact",
      "path": "/chargebee_contacts/{chargebeeCustomerId}",
      "method": "POST",
      "description": "Adds a contact to a chargebee customer",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeCustomerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-delete-chargebee-contact",
      "path": "/chargebee_contacts/{chargebeeCustomerId}/{contactId}",
      "method": "DELETE",
      "description": "Deletes a contact from a chargebee customer",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeCustomerId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "contactId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-next-billing-date-by-customer-ids",
      "path": "/chargebee_customers/next_billing_dates",
      "method": "GET",
      "description": "Lists the next billing date for an array of chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-bulk-update-chargebee-billing-informations",
      "path": "/chargebee_sources/{organisationId}/bulk_update",
      "method": "PUT",
      "description": "Updates chargebee billing informations for an organisation",
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
      "id": "api-notify-shop-delete",
      "path": "/shops/{id}",
      "method": "DELETE",
      "description": "Creates an entry in SQS for Shop Delete",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-notify-organisation-delete",
      "path": "/organisations/{id}",
      "method": "DELETE",
      "description": "Creates an entry in SQS for Organisation Delete",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-request-sf-organisation-delete",
      "path": "/requests/organisations/{id}",
      "method": "DELETE",
      "description": "Calls SF to request deletion of organisation",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-request-salesforce-shop-delete",
      "path": "/requests/shops/{id}",
      "method": "DELETE",
      "description": "Calls SF to request deletion of shop",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-self-serve-chargebee-id",
      "path": "/self_serve/chargebee_ids",
      "method": "POST",
      "description": "POST /self_serve/chargebee_ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-company-registrations",
      "path": "/company_registrations",
      "method": "GET",
      "description": "GET /company_registrations",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-update-self-serve-subscription",
      "path": "/self_serve/update_subscription",
      "method": "POST",
      "description": "Calls SF to update the subscriptions status of the client",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-update-self-serve-infos-by-step",
      "path": "/self_serve/infos_by_step",
      "method": "POST",
      "description": "Sends self serve informations to SF for each step",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-create-quote-by-orga-id",
      "path": "/quote",
      "method": "POST",
      "description": "Create a quote from an existing organisation",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-stop-free-trial-for-organisation",
      "path": "/organisations/{organisationId}/stop_free_trial",
      "method": "PATCH",
      "description": "Sends a message to updateSkelloOrganisationSqs to stop the free trial",
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
      "id": "api-get-organisation-contracts",
      "path": "/organisations/{organisationId}/contracts",
      "method": "GET",
      "description": "Get the list of contracts attached to an organisation",
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
      "id": "api-trigger-sfn-shops-synchronization",
      "path": "/shops-synchronization",
      "method": "POST",
      "description": "Triggers the shops synchronization sfn",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-upsert-shop",
      "path": "/shop",
      "method": "POST",
      "description": "Upsert the shop pack and options",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-update-shop-2",
      "path": "/shop/{id}",
      "method": "PATCH",
      "description": "Updates the shop pack and options",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-shop-by-jwt",
      "path": "/client/shop/{id}",
      "method": "GET",
      "description": "Get the shop pack and options",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "pricing-get-one-api",
      "path": "/pricing/{country}",
      "method": "GET",
      "description": "Gets one pricing",
      "useCase": "",
      "params": [
        {
          "name": "country",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "pricing-upsert-api",
      "path": "/pricing",
      "method": "POST",
      "description": "Upserts a pricing",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-shops-quota",
      "path": "/shops/quota",
      "method": "GET",
      "description": "Fetches the shops quota from either dynamo or salesforce",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-request-upsell-by-type",
      "path": "/request-upsell/{upsellType}",
      "method": "POST",
      "description": "Get the list of contracts attached to an organisation",
      "useCase": "",
      "params": [
        {
          "name": "upsellType",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-use-credit-balance",
      "path": "/credit-balance/{organisationId}/{featureKey}/use",
      "method": "POST",
      "description": "Use one credit for organization and feature",
      "useCase": "",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "featureKey",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-post-shop-contract-finalize",
      "path": "/shop/{shopId}/finalize_contract",
      "method": "POST",
      "description": "Finalize contract for a given shop",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-post-shop-contract-estimation",
      "path": "/shop/{shopId}/estimate_contract",
      "method": "POST",
      "description": "Estimate pricing for a given shop",
      "useCase": "",
      "params": [
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-post-orga-contract-finalize",
      "path": "/organisation/{organisationId}/finalize_contract",
      "method": "POST",
      "description": "Finalize annual upsell for a given organisation",
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
      "id": "api-post-orga-contract-estimation",
      "path": "/organisation/{organisationId}/estimate_contract",
      "method": "POST",
      "description": "Estimate pricing for a given organisation",
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
      "id": "api-send-upsell-interest",
      "path": "/upsell-interest",
      "method": "POST",
      "description": "Send upsell interest to Salesforce",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-list-credit-notes",
      "path": "/credit_notes",
      "method": "GET",
      "description": "Lists credit notes for given chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-list-invoices",
      "path": "/invoices",
      "method": "GET",
      "description": "Lists invoices for given chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-shops-quota-v2026",
      "path": "/v2026/shops/quota",
      "method": "GET",
      "description": "Fetches the shops quota from either dynamo or salesforce",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-chargebee-sources-v2026",
      "path": "/v2026/chargebee_sources",
      "method": "GET",
      "description": "Lists chargebee payment sources for an array of chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-create-quote-by-orga-id-v2026",
      "path": "/v2026/quote",
      "method": "POST",
      "description": "Create a quote from an existing organisation",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-quote-by-id-v2026",
      "path": "/v2026/quote/{id}",
      "method": "GET",
      "description": "GET /v2026/quote/{id}",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-validate-quote-v2026",
      "path": "/v2026/quote/{id}/validate",
      "method": "PATCH",
      "description": "PATCH /v2026/quote/{id}/validate",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-update-quote-billing-v2026",
      "path": "/v2026/quote/{id}/billing",
      "method": "PATCH",
      "description": "PATCH /v2026/quote/{id}/billing",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-update-quote-shop-billing-v2026",
      "path": "/v2026/quote/{id}/shop/billing",
      "method": "PATCH",
      "description": "PATCH /v2026/quote/{id}/shop/billing",
      "useCase": "",
      "params": [
        {
          "name": "id",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-create-checkout-by-chargebee-id-v2026",
      "path": "/v2026/checkout/{chargebeeId}",
      "method": "POST",
      "description": "POST /v2026/checkout/{chargebeeId}",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-upsert-organisation-by-quote-id-v2026",
      "path": "/v2026/organisations",
      "method": "POST",
      "description": "POST /v2026/organisations",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-start-contract-change-provisioning-v2026",
      "path": "/v2026/organisations/start_contract_change",
      "method": "POST",
      "description": "POST /v2026/organisations/start_contract_change",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-create-chargebee-source-v2026",
      "path": "/v2026/chargebee_sources/{chargebeeId}",
      "method": "POST",
      "description": "POST /v2026/chargebee_sources/{chargebeeId}",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {}
    },
    {
      "id": "api-get-company-registrations-v2026",
      "path": "/v2026/company_registrations",
      "method": "GET",
      "description": "GET /v2026/company_registrations",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-get-chargebee-id-from-sf-by-jwtv2026",
      "path": "/v2026/client/organisations/{organisationId}/chargebee_ids",
      "method": "GET",
      "description": "Called from client: Gets the list of chargebee ids for an organisation (v2026)",
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
      "id": "api-get-organisation-contracts-v2026",
      "path": "/v2026/organisations/{organisationId}/contracts",
      "method": "GET",
      "description": "Get the list of contracts attached to an organisation (v2026)",
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
      "id": "api-get-next-billing-date-by-customer-ids-v2026",
      "path": "/v2026/chargebee_customers/next_billing_dates",
      "method": "GET",
      "description": "Lists the next billing date for an array of chargebee customer ids",
      "useCase": "",
      "params": [],
      "response": {}
    },
    {
      "id": "api-create-portal-session-by-c-bee-id-v2026",
      "path": "/v2026/portal_sessions/{chargebeeId}",
      "method": "POST",
      "description": "Creates a chargebee portal session object from Chargebee ID",
      "useCase": "",
      "params": [
        {
          "name": "chargebeeId",
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
