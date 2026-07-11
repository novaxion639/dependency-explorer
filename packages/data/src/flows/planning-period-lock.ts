import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11: WeeklyOptionsController#validate_period →
// V3::WeeklyOptions::LockService over the WeeklyOption lock levels, an
// ActivityJob audit, and — for intermediate locks — PlanningNotifier →
// Microservices::NotificationMailerJob → comms-v2 /email/low-priority.
// unlock_request is notification-only (no state change).
const planning_period_lock: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-period-lock",
  "name": "Planning Period Lock / Unlock",
  "description": "A manager locks or unlocks a planning period (day, week or month). WeeklyOptionsController#validate_period runs V3::WeeklyOptions::LockService over the period's WeeklyOption rows (per-shop, per-monday lock levels), audits the action through ActivityJob → svc-events, and — when an intermediate lock is set — emails the higher authority through PlanningNotifier → NotificationMailerJob → svc-communications-v2 (/email/low-priority). The separate unlock_request action changes nothing: it only sends the unlock-request email through the same notifier.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/weekly_options/validate_period — lock or unlock with validation_level"
    },
    {
      "from": "skello-app",
      "to": "svc-events",
      "action": "Audit activity via ActivityJob (validate_day / validate_all_days / un…)"
    },
    {
      "from": "skello-app",
      "to": "svc-communications-v2",
      "action": "Intermediate-lock / unlock-request email (NotificationMailerJob → /email/low-priority)"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/weekly_options/unlock_request — ask a higher authority to unlock (email only)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-lock-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::WeeklyOptionsController#validate_period",
      "path": "app/controllers/v3/api/weekly_options_controller.rb",
      "description": "Gates intermediate unlocks (can_unlock_intermediate_validate), runs the lock, audits, and notifies on intermediate locks; #unlock_request is the email-only sibling"
    },
    {
      "id": "cu-lock-service",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::WeeklyOptions::LockService",
      "path": "app/services/v3/weekly_options/lock_service.rb",
      "description": "Writes the lock level/value onto the WeeklyOption row of each affected monday × shop"
    },
    {
      "id": "cu-lock-activity",
      "service": "skello-app",
      "kind": "job",
      "label": "ActivityJob",
      "path": "app/jobs/activity_job.rb",
      "description": "Audit trail: validate_day / validate_all_days (or their un- variants) with shop/user context → svc-events"
    },
    {
      "id": "cu-lock-notifier",
      "service": "skello-app",
      "kind": "service",
      "label": "PlanningNotifier",
      "path": "app/services/planning_notifier.rb",
      "description": "notify_planning_intermediary_lock / notify_unlock_request — builds the email payloads"
    },
    {
      "id": "cu-lock-mailer",
      "service": "skello-app",
      "kind": "job",
      "label": "Microservices::NotificationMailerJob",
      "path": "app/jobs/microservices/notification_mailer_job.rb",
      "description": "Sidekiq mailer bridge: Microservices::CommunicationsV2 builder + /email/low-priority (with the legacy comms-v1 fallback path)"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-lock-controller",
      "label": "POST validate_period / unlock_request",
      "mode": "sync"
    },
    {
      "from": "cu-lock-controller",
      "to": "cu-lock-service",
      "label": "V3::WeeklyOptions::LockService.run!",
      "mode": "sync"
    },
    {
      "from": "cu-lock-service",
      "to": "pg-period-lock",
      "label": "WeeklyOption lock level/value per monday × shop",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "cu-lock-controller",
      "to": "cu-lock-activity",
      "label": "ActivityJob.perform_later",
      "mode": "async-job"
    },
    {
      "from": "cu-lock-controller",
      "to": "cu-lock-notifier",
      "label": "PlanningNotifier intermediary lock / unlock request",
      "mode": "sync",
      "condition": "intermediate validation with lock, or unlock_request"
    },
    {
      "from": "cu-lock-notifier",
      "to": "cu-lock-mailer",
      "label": "Microservices::NotificationMailerJob.perform_later",
      "mode": "async-job"
    },
    {
      "from": "cu-lock-mailer",
      "to": "svc-communications-v2",
      "label": "POST /email/low-priority",
      "mode": "sync"
    },
    {
      "from": "cu-lock-activity",
      "to": "svc-events",
      "label": "POST /events — lock activity",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-period-lock",
      "type": "postgresql",
      "label": "skello_production — weekly_options",
      "description": "Per-shop, per-monday validation levels — the lock state the shift services check before edits"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-period-lock",
      "label": "lock state",
      "crud": ["update"]
    }
  ]
})

export default planning_period_lock
