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
  "trigger": {
    "actor": "manager",
    "role": "HR"
  },
  "primaryArea": "employees-hr",
  "chapters": [
    {
      "title": "A manager creates an employee",
      "summary": "The employee form posts the new hire to skello-app, which resolves their license.",
      "refs": [
        "skello-app-front",
        "cu-eo-controller"
      ]
    },
    {
      "title": "The employee record is built",
      "summary": "One transaction creates the user, contract, schedule, planning config and team memberships.",
      "refs": [
        "cu-eo-create-service",
        "cu-eo-memberships",
        "pg-skello-onboarding"
      ]
    },
    {
      "title": "Invitations are sent",
      "summary": "A background job sends the invitation and onboarding emails through svc-communications-v2.",
      "refs": [
        "cu-eo-mailer",
        "svc-communications-v2"
      ]
    },
    {
      "title": "The hiring declaration is filed",
      "summary": "The manager records the DPAE deposit; svc-employees submits it to URSSAF and follows it up.",
      "refs": [
        "cu-eo-dpae-controller",
        "cu-eo-dpae-manager",
        "dynamo-employees-onboarding"
      ]
    },
    {
      "title": "The DPAE status comes back",
      "summary": "A follow-up state machine waits, checks URSSAF until the declaration leaves pending, then writes its status back into skello-app.",
      "refs": [
        "sm-dpae",
        "cu-eo-dpae-check",
        "cu-eo-dpae-sfn",
        "svc-employees",
        "skello-app"
      ]
    },
    {
      "title": "The rows are replicated",
      "summary": "DMS copies the employee and contract rows to svc-search.",
      "refs": [
        "pg-skello-onboarding",
        "svc-search"
      ]
    }
  ],
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
      "id": "cu-eo-dpae-check",
      "service": "svc-employees",
      "kind": "job",
      "label": "CheckDpaeStatusSfnJobHandler",
      "path": "src/Handler/Job/Dpae/CheckDpaeStatusSfnJobHandler.ts",
      "description": "Step-function step asking URSSAF (through the Fortify DPAE API) for the declaration status; on error code 50 it requests an SST refresh"
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
      "crud": [
        "create"
      ]
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
      "crud": [
        "create",
        "update"
      ]
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
    },
    {
      "from": "cu-eo-dpae-manager",
      "to": "sm-dpae",
      "label": "start DPAE follow-up",
      "mode": "async-job"
    },
    {
      "from": "cu-eo-dpae-check",
      "to": "cu-eo-dpae-manager",
      "label": "check URSSAF status",
      "mode": "sync"
    }
  ],
  "stateMachines": [
    {
      "id": "sm-dpae",
      "service": "svc-employees",
      "machine": "dpaeFollowUp",
      "label": "DPAE follow-up",
      "file": "serverless/resources/stepFunctions/index.ts",
      "start": "smd-init",
      "states": [
        {
          "id": "smd-init",
          "name": "Init retry counter",
          "type": "pass",
          "label": "init retry counter",
          "next": "smd-wait"
        },
        {
          "id": "smd-wait",
          "name": "Wait",
          "type": "wait",
          "label": "wait",
          "next": "smd-check"
        },
        {
          "id": "smd-check",
          "name": "Check DPAE Status",
          "type": "task",
          "label": "check URSSAF status",
          "unit": "cu-eo-dpae-check",
          "next": "smd-pending"
        },
        {
          "id": "smd-pending",
          "name": "Is request pending?",
          "type": "choice",
          "label": "pending?",
          "choices": [
            {
              "when": "pending",
              "next": "smd-increment"
            }
          ],
          "default": "smd-update"
        },
        {
          "id": "smd-increment",
          "name": "Increment retry counter",
          "type": "pass",
          "label": "increment counter",
          "next": "smd-exhausted"
        },
        {
          "id": "smd-exhausted",
          "name": "Choice",
          "type": "choice",
          "label": "retries exhausted?",
          "choices": [
            {
              "when": "counter ≥ max",
              "next": "smd-clean"
            }
          ],
          "default": "smd-wait"
        },
        {
          "id": "smd-clean",
          "name": "Remove fields dedicated to step function logic",
          "type": "pass",
          "label": "clean fields",
          "next": "smd-update"
        },
        {
          "id": "smd-update",
          "name": "Update Skello DPAE status",
          "type": "task",
          "label": "update skello status",
          "unit": "cu-eo-dpae-sfn"
        }
      ]
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-onboarding",
      "type": "postgresql",
      "label": "skello_production — users, contracts, memberships, dpae_deposits",
      "resources": [
        "pg:skello_production.users",
        "pg:skello_production.contracts",
        "pg:skello_production.memberships",
        "pg:skello_production.dpae_deposits"
      ],
      "description": "The employee's core rows, built in one transaction; DPAE deposits tracked per contract"
    },
    {
      "id": "dynamo-employees-onboarding",
      "type": "dynamodb",
      "label": "SvcEmployees ({env})",
      "resources": [
        "ddb:svcEmployees-restaure"
      ],
      "description": "svc-employees' own store — DPAE submission state and step-function follow-up"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-onboarding",
      "label": "employee record",
      "crud": [
        "create"
      ]
    },
    {
      "from": "svc-employees",
      "to": "dynamo-employees-onboarding",
      "label": "DPAE lifecycle state",
      "crud": [
        "create",
        "update"
      ]
    }
  ]
})

export default employee_onboarding
