import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_hiring: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-hiring",
  "type": "typescript-microservice",
  "description": "Bridge to the Join hiring/ATS product: provisions the organisation's Join account and issues auto-login tokens (the front opens the returned redirectUrl in a new tab from the navbar's Hiring entry). Surfaced 2026-06-15 by the flow inventory: @skelloapp/svc-hiring-sdk value import + VUE_APP_SVC_HIRING_API_URL in the front, Microservices::HiringService (SVC_HIRING_URL) in the monolith. Repo not checked out locally — endpoints below are the two evidenced call sites, not a full scaffold.",
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
    }
  ],
  "databases": []
})

export default svc_hiring
