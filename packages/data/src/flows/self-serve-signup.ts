import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory candidate #3 (billing/onboarding — zero-flow domains).
// Traced 2026-06-15: v3/api/self_serve_controller.rb → create_prospect_service
// + registrate_service + self_serve/{billing_automation,salesforce_notify}
// services + microservices/onboarding_mailer_job.rb. The SelfServe front app
// itself is outside the map (GLOBAL board); the identity leg (svc-users
// POST /sign-up on auth.skello.io, ALB-served) belongs to that unmapped front.
const self_serve_signup: ServiceFlow = ServiceFlowSchema.parse({
  "id": "self-serve-signup",
  "name": "Self-Serve Signup",
  "description": "A prospect signs up through the self-serve funnel (SkelloSelfServe front, outside the map). The monolith drives the funnel step by step: a Prospect row with activation token, then user registration (User + planning config + extended info), shop & organisation creation (with a labour-law convention canary check), while every completed step is synced to svc-billing-automation (step infos + /pricing) AND pushed as a lead create/update DIRECTLY to Salesforce over HTTP from the monolith. Onboarding emails go out through comms-v2 (with attachments; comms-v1 fallback), plus an internal Skello-team notification. The account-identity leg (svc-users POST /sign-up) is called by the SelfServe front itself.",
  "steps": [
    {
      "from": "skello-app",
      "to": "svc-billing-automation",
      "action": "Sync each funnel step + fetch pricing (SelfServe::BillingAutomationService → Microservices::BillingAutomationService POST per step, POST /pricing)"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "Onboarding emails with attachments (OnboardingMailerJob → CommunicationsV2 Builder/ClientService; comms-v1 fallback path present)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ss-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::SelfServeController",
      "path": "app/controllers/v3/api/self_serve_controller.rb",
      "description": "Funnel steps: #create (prospect + registration), #create_shop_and_organisation (with LabourLaw convention canary check), #activate — each step notifies billing and Salesforce"
    },
    {
      "id": "cu-ss-prospect",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Users::CreateProspectService",
      "path": "app/services/v3/users/create_prospect_service.rb",
      "description": "Prospect row with a unique activation token"
    },
    {
      "id": "cu-ss-registrate",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Users::RegistrateService",
      "path": "app/services/v3/users/registrate_service.rb",
      "description": "User.create + UserPlanningConfig + UserExtendedInfo; enqueues onboarding emails and the internal SkelloTeamMailerJob"
    },
    {
      "id": "cu-ss-billing-notify",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::SelfServe::BillingAutomationService",
      "path": "app/services/v3/self_serve/billing_automation_service.rb",
      "description": "send_infos_by_step — posts funnel-step data to svc-billing-automation and relays the /pricing response"
    },
    {
      "id": "cu-ss-salesforce",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::SelfServe::SalesforceNotifyService",
      "path": "app/services/v3/self_serve/salesforce_notify_service.rb",
      "description": "Lead create (POST) / update (PATCH) pushed DIRECTLY to Salesforce over HTTP from the monolith — an external integration outside the billing↔Salesforce path the GLOBAL board draws"
    },
    {
      "id": "cu-ss-onboarding-mailer",
      "service": "skello-app",
      "kind": "job",
      "label": "Microservices::OnboardingMailerJob",
      "path": "app/jobs/microservices/onboarding_mailer_job.rb",
      "description": "Builds onboarding emails with attachments via CommunicationsV2 Builder/ClientService (comms-v1 send_attachment fallback still present)"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-ss-controller",
      "to": "cu-ss-prospect",
      "label": "funnel step 1 — prospect",
      "mode": "sync"
    },
    {
      "from": "cu-ss-controller",
      "to": "cu-ss-registrate",
      "label": "register the user",
      "mode": "sync"
    },
    {
      "from": "cu-ss-controller",
      "to": "pg-skello-signup",
      "label": "shop + organisation creation",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-ss-controller",
      "to": "cu-ss-billing-notify",
      "label": "sync step to billing",
      "mode": "sync",
      "condition": "per completed funnel step"
    },
    {
      "from": "cu-ss-controller",
      "to": "cu-ss-salesforce",
      "label": "lead create/update",
      "mode": "sync",
      "condition": "per completed funnel step"
    },
    {
      "from": "cu-ss-prospect",
      "to": "pg-skello-signup",
      "label": "Prospect row + activation token",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-ss-registrate",
      "to": "pg-skello-signup",
      "label": "User + planning config + extended info",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-ss-registrate",
      "to": "cu-ss-onboarding-mailer",
      "label": "onboarding + internal team emails",
      "mode": "async-job"
    },
    {
      "from": "cu-ss-onboarding-mailer",
      "to": "svc-communications-v2",
      "label": "emails with attachments",
      "mode": "sync"
    },
    {
      "from": "cu-ss-billing-notify",
      "to": "svc-billing-automation",
      "label": "POST step infos + /pricing",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-signup",
      "type": "postgresql",
      "label": "skello_production — prospects, users, shops, organisations",
      "description": "The self-serve funnel's core rows: prospect with activation token, then user, shop and organisation"
    },
    {
      "id": "redis-skello-signup",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for the mailer jobs"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-signup",
      "label": "funnel rows",
      "crud": ["create"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-signup",
      "label": "enqueue mailers"
    }
  ]
})

export default self_serve_signup
