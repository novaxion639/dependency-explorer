import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_hiring: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-hiring",
  "type": "typescript-microservice",
  "description": "Bridge to the Join hiring/ATS product: provisions the organisation's Join account and issues auto-login tokens (the front opens the returned redirectUrl in a new tab from the navbar's Hiring entry). Keeps Join companies/offices/accounts in sync by consuming the monolith's DMS CDC backbone (ProcessDmsStreamJob on skelloapp-bus, filtered to organisations/shops/users/user_licenses/memberships → SyncJoinFromSkelloAppJobHandler) with an own setupJoinAccounts SQS job for account provisioning — surfaced by the AWS live-verification pilot 2026-07-18, code-verified after cloning the repo. Front/monolith call sites: @skelloapp/svc-hiring-sdk + VUE_APP_SVC_HIRING_API_URL in the front, Microservices::HiringService (SVC_HIRING_URL) in the monolith. Endpoints below are the two evidenced call sites, not a full scaffold.",
  "endpoints": [
    {
      "id": "api-generate-join-token",
      "path": "/join_token",
      "method": "POST",
      "description": "Provisions the Join account if needed and returns the auto-login redirectUrl",
      "useCase": "Front navbar Hiring entry (useOpenHiring) — opens Join in a new tab, signed in",
      "params": [],
      "response": {},
      "provenance": {
        "source": "manual",
        "lastVerified": "2026-06-15",
        "evidence": "skello-app-front apps/base-app/src/apis/svcHiring/JoinToken/joinTokenApis.ts — svcHiringRepository.generateJoinToken(SetupRequestDto)"
      }
    },
    {
      "id": "api-setup",
      "path": "/setup",
      "method": "POST",
      "description": "Organisation setup on the Join side, driven by the monolith",
      "useCase": "",
      "params": [],
      "response": {},
      "provenance": {
        "source": "manual",
        "lastVerified": "2026-06-15",
        "evidence": "skello-app app/services/microservices/hiring_service.rb — make_request(:post, '/setup')"
      }
    },
    {
      "id": "api-hiring-deletion-check",
      "path": "/v1/join/organisations/{organisationId}/shops/{shopId}/hiring-deletion-check",
      "method": "GET",
      "description": "Read-only guard: is this the last shop with the Hiring option before deletion?",
      "useCase": "Checked before shop deletion so removing the last Hiring-enabled shop can be surfaced to the user",
      "params": [
        {
          "name": "organisationId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        },
        {
          "name": "shopId",
          "in": "path",
          "type": "string",
          "required": true,
          "description": ""
        }
      ],
      "response": {},
      "provenance": {
        "source": "manual",
        "lastVerified": "2026-07-18",
        "evidence": "svc-hiring serverless/functions/api.ts — HiringDeletionCheckApi (adopted from static-scan drift after cloning the repo)"
      }
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcHiring-{env}",
      "description": "Join account/integration state — declared in svc-hiring-tf (stream enabled)"
    }
  ]
})

export default svc_hiring
