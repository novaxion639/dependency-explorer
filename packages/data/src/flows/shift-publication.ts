import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-06-12 (weekly_options_controller#publish_planning →
// publish_service.rb → publish_job.rb). Publication is the moment employees
// actually get notified about their planning — create/update/delete stay
// silent. The previously documented svc-events planning.published audit had
// no code path; the real fan-out is PublishJob calling svc-shops (missions)
// and svc-communications-v2 (push/SMS + email with the planning PDF attached).
const shift_publication: ServiceFlow = ServiceFlowSchema.parse({
  "id": "shift-publication",
  "name": "Planning Publication",
  "description": "A planner publishes the week. The monolith records per-user WeeklyOptionPublication rows and marks the week published, then PublishJob (Sidekiq) builds the notification fan-out: missions fetched from svc-shops, the planning PDF rendered in-process, then push/SMS notifications and high-priority emails (PDF attached) sent through svc-communications-v2 — with a legacy comms-v1 fallback path still present. (Corrected 2026-06-12: publication lives on WeeklyOptions, not /v3/shifts/publish; no svc-events audit exists in this path.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "Publish planning — WeeklyOptionsController#publish_planning (selected_user_ids, sms/email flags)"
    },
    {
      "from": "skello-app",
      "to": "svc-shops",
      "action": "Read shop missions for the notification payload (Microservices::ShopsService.get_missions, from PublishJob)"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "Send push/SMS notifications and high-priority emails with the planning PDF attached (CommunicationsV2 ClientService, from PublishJob)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-pub-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::WeeklyOptionsController#publish_planning",
      "path": "app/controllers/v3/api/weekly_options_controller.rb",
      "description": "Filters the selected users by team permissions and archival window, then delegates to PublishService"
    },
    {
      "id": "cu-pub-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::WeeklyOptionPublications::PublishService",
      "path": "app/services/v3/weekly_option_publications/publish_service.rb",
      "description": "Creates/updates per-user WeeklyOptionPublication rows, marks the weekly options published, enqueues PublishJob with the sms/email flags"
    },
    {
      "id": "cu-pub-job",
      "service": "skello-app",
      "kind": "job",
      "label": "PublishJob",
      "path": "app/jobs/publish_job.rb",
      "description": "The notification fan-out: missions from svc-shops, per-user push/SMS built via CommunicationsV2::Builder, planning PDF rendered and attached to high-priority emails; falls back to comms-v1 + NotificationMailerJob on the legacy path"
    },
    {
      "id": "cu-pub-pdf",
      "service": "skello-app",
      "kind": "service",
      "label": "Plannings::PlanningPdfBuilderService",
      "path": "app/services/plannings/planning_pdf_builder_service.rb",
      "description": "Renders the published week as the PDF attached to employee emails — built in-process inside PublishJob"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-pub-controller",
      "label": "publish planning",
      "mode": "sync"
    },
    {
      "from": "cu-pub-controller",
      "to": "cu-pub-service",
      "label": ".run!",
      "mode": "sync"
    },
    {
      "from": "cu-pub-service",
      "to": "pg-skello-publication",
      "label": "WeeklyOptionPublication rows + publish flags",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-pub-service",
      "to": "cu-pub-job",
      "label": "perform_async (sms/email flags)",
      "mode": "async-job"
    },
    {
      "from": "cu-pub-job",
      "to": "svc-shops",
      "label": "get_missions",
      "mode": "sync"
    },
    {
      "from": "cu-pub-job",
      "to": "cu-pub-pdf",
      "label": "render planning PDF",
      "mode": "sync",
      "condition": "email notification enabled"
    },
    {
      "from": "cu-pub-job",
      "to": "svc-communications-v2",
      "label": "POST /notifications/high-priority + /email/high-priority (PDF attached)",
      "mode": "sync",
      "condition": "per-user sms/email flags"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-publication",
      "type": "postgresql",
      "label": "skello_production — weekly_option_publications, weekly_options",
      "description": "Per-user publication rows and the week's published state"
    },
    {
      "id": "redis-skello-publication",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker carrying PublishJob"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-publication",
      "label": "record publication",
      "crud": ["create", "update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-publication",
      "label": "enqueue PublishJob"
    }
  ]
})

export default shift_publication
