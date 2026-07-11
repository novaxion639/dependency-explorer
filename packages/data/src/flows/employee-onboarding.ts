import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory candidate #5 (HR core). Traced 2026-06-15 on both sides:
// skello-app users_controller#create → v3/users/create_service.rb (+ the
// dpae_deposits controller whose #update is marked 'called only by
// svc-employee'), and svc-employees' DPAE step function (DpaeController /
// DpaeManager / UpdateSkelloDpaeStatusSfnJobHandler). The DPAE status
// write-back is the third verified strangler reverse edge (after svc-users,
// svc-requests and svc-billing-automation) — added with this flow.
const employee_onboarding: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-onboarding",
  "name": "Employee Onboarding",
  "description": "A manager creates a new employee. One transactional service builds the whole record — User, Contract, schedule amendments, planning config, extended info, team memberships — then invitation emails go out through comms-v2 and the internal Skello-team mailer. The legal leg runs through svc-employees: the DPAE (pre-hiring declaration to URSSAF, via the Fortify cluster per the GLOBAL board) is tracked as DpaeDeposit rows in the monolith, submitted and followed up by svc-employees' DPAE step function, which writes the resulting status BACK into the monolith's dpae_deposits#update — an endpoint the code marks 'called only by svc-employee'.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Create employee — V3::Api::UsersController#create (user + contract + memberships + invitation params)"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "Invitation / onboarding emails (OnboardingMailerJob)"
    },
    {
      "from": "svc-employees",
      "to": "skello-app",
      "action": "DPAE status write-back — dpae_deposits#update ('called only by svc-employee')"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-eo-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::UsersController#create",
      "path": "app/controllers/v3/api/users_controller.rb",
      "description": "Employee creation entry — delegates to CreateService, resolves the employee's license (Licenses::Resolver)"
    },
    {
      "id": "cu-eo-create-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Users::CreateService",
      "path": "app/services/v3/users/create_service.rb",
      "description": "Builds the full employee record: User + Contract + TeamSchedules::AmendmentBulkCreateService + UserPlanningConfig + UserExtendedInfo; enqueues onboarding and internal-team mailers"
    },
    {
      "id": "cu-eo-memberships",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Memberships::ManageService",
      "path": "app/services/v3/memberships/manage_service.rb",
      "description": "Shop/team membership assignment for the new employee"
    },
    {
      "id": "cu-eo-mailer",
      "service": "skello-app",
      "kind": "job",
      "label": "Microservices::OnboardingMailerJob",
      "path": "app/jobs/microservices/onboarding_mailer_job.rb",
      "description": "Invitation and onboarding emails via CommunicationsV2 Builder/ClientService"
    },
    {
      "id": "cu-eo-dpae-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::DpaeDepositsController",
      "path": "app/controllers/v3/api/dpae_deposits_controller.rb",
      "description": "#create records the DpaeDeposit against the contract (resetting previous dpae_done flags); #update is the write-back surface reserved for svc-employees"
    },
    {
      "id": "cu-eo-dpae-manager",
      "service": "svc-employees",
      "kind": "manager",
      "label": "DpaeManager",
      "path": "src/Manager/DpaeManager.ts",
      "description": "Drives the DPAE lifecycle on the service side — submission to URSSAF through the Fortify integration and follow-up status checks (CheckDpaeStatusSfnJobHandler)"
    },
    {
      "id": "cu-eo-dpae-sfn",
      "service": "svc-employees",
      "kind": "job",
      "label": "UpdateSkelloDpaeStatusSfnJobHandler",
      "path": "src/Handler/Job/Dpae/UpdateSkelloDpaeStatusSfnJobHandler.ts",
      "description": "Step-function step pushing the DPAE status back into the monolith (SKELLO_APP_API_URL + SKELLO_APP_EMPLOYEES_API_KEY)"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-eo-controller",
      "label": "create employee",
      "mode": "sync"
    },
    {
      "from": "cu-eo-controller",
      "to": "cu-eo-create-service",
      "label": ".run!",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-eo-create-service",
      "to": "pg-skello-onboarding",
      "label": "User + Contract + configs + schedule amendments",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["create"]
    },
    {
      "from": "cu-eo-create-service",
      "to": "cu-eo-memberships",
      "label": "assign shop/team memberships",
      "mode": "sync",
      "inTransaction": true
    },
    {
      "from": "cu-eo-create-service",
      "to": "cu-eo-mailer",
      "label": "invitation + internal-team emails",
      "mode": "async-job"
    },
    {
      "from": "cu-eo-mailer",
      "to": "svc-communications-v2",
      "label": "onboarding emails",
      "mode": "sync"
    },
    {
      "from": "skello-app-front",
      "to": "cu-eo-dpae-controller",
      "label": "record DPAE deposit",
      "mode": "sync"
    },
    {
      "from": "cu-eo-dpae-controller",
      "to": "pg-skello-onboarding",
      "label": "DpaeDeposit row (previous dpae_done reset)",
      "mode": "sync",
      "inTransaction": true,
      "crud": ["create", "update"]
    },
    {
      "from": "cu-eo-dpae-sfn",
      "to": "cu-eo-dpae-manager",
      "label": "follow-up result",
      "mode": "sync"
    },
    {
      "from": "cu-eo-dpae-manager",
      "to": "skello-app",
      "label": "PATCH dpae_deposits — status write-back",
      "mode": "sync"
    },
    {
      "from": "pg-skello-onboarding",
      "to": "svc-search",
      "label": "DMS CDC → raw employees/contracts replicas",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-onboarding",
      "type": "postgresql",
      "label": "skello_production — users, contracts, memberships, dpae_deposits",
      "description": "The employee's core rows, built in one transaction; DPAE deposits tracked per contract"
    },
    {
      "id": "dynamo-employees-onboarding",
      "type": "dynamodb",
      "label": "SvcEmployees ({env})",
      "description": "svc-employees' own store — DPAE submission state and step-function follow-up"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-onboarding",
      "label": "employee record",
      "crud": ["create"]
    },
    {
      "from": "svc-employees",
      "to": "dynamo-employees-onboarding",
      "label": "DPAE lifecycle state",
      "crud": ["create", "update"]
    }
  ]
})

export default employee_onboarding
