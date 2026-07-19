import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Code layer traced 2026-07-11. Applying a template uses the same
// 5-weeks-sync / rest-async split as week-copy (CreateFromTemplateJob per
// extra week). The remaining fabrications were removed: no monolith event,
// no skello-sqs-events queue, no shift-notify-dispatch lambda, no
// notification — employees hear about their shifts at publication.
const planning_template: ServiceFlow = ServiceFlowSchema.parse({
  "id": "planning-template",
  "name": "Planning Template — Save & Apply",
  "description": "A manager saves the current week's planning as a reusable template, or applies one to populate a week. Save = TemplatesController#create snapshots the shop's shifts. Apply = the first 5 selected weeks run synchronously through V3::Templates::ApplyService (shift creation with in-process labour-law compliance, skipped-postes reporting, counter updates via CombinedTrackerUpdateService); any further weeks are enqueued one CreateFromTemplateJob each — the same sync/async split as week-copy. Nobody is notified; publication does that.",
  "trigger": {"actor": "manager", "role": "planner"},
  "links": [{"to": "week-copy", "kind": "domain-related", "note": "template application reuses the week-copy engine"}],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST /v3/api/plannings/templates — save current week as a named template"
    },
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "POST apply — populate the selected week(s) from a template (5 sync + rest async)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-tpl-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::Plannings::TemplatesController",
      "path": "app/controllers/v3/api/plannings/templates_controller.rb",
      "description": "#create snapshots the shop's current shifts as a template; #apply splits the selected weeks into 5 synchronous + N async and reports skipped postes"
    },
    {
      "id": "cu-tpl-apply",
      "service": "skello-app",
      "kind": "service",
      "label": "V3::Templates::ApplyService",
      "path": "app/services/v3/templates/apply_service.rb",
      "description": "Creates the template's shifts onto the target week (labour-law compliance in-process), tracks skipped postes, and recomputes counters for assigned users"
    },
    {
      "id": "cu-tpl-async-job",
      "service": "skello-app",
      "kind": "job",
      "label": "CreateFromTemplateJob",
      "path": "app/jobs/create_from_template_job.rb",
      "description": "Sidekiq job applying the template to one extra week (weeks beyond the first 5)"
    },
    {
      "id": "cu-tpl-tracker",
      "service": "skello-app",
      "kind": "manager",
      "label": "V3::CombinedTrackerUpdateService",
      "path": "app/services/v3/combined_tracker_update_service.rb",
      "description": "Hours / RCR / paid-leave counters for the users receiving shifts"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-tpl-controller",
      "label": "save template / apply template",
      "mode": "sync"
    },
    {
      "from": "cu-tpl-controller",
      "to": "pg-templates",
      "label": "template snapshot (create)",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-tpl-controller",
      "to": "cu-tpl-apply",
      "label": "V3::Templates::ApplyService.run!",
      "mode": "sync",
      "condition": "first 5 selected weeks"
    },
    {
      "from": "cu-tpl-controller",
      "to": "cu-tpl-async-job",
      "label": "CreateFromTemplateJob.perform_async per week",
      "mode": "async-job",
      "condition": "weeks beyond the first 5"
    },
    {
      "from": "cu-tpl-async-job",
      "to": "cu-tpl-apply",
      "label": "V3::Templates::ApplyService.run!",
      "mode": "sync"
    },
    {
      "from": "cu-tpl-apply",
      "to": "pg-templates",
      "label": "create shifts from template",
      "mode": "sync",
      "crud": ["create"]
    },
    {
      "from": "cu-tpl-apply",
      "to": "cu-tpl-tracker",
      "label": "V3::CombinedTrackerUpdateService (assigned users)",
      "mode": "sync"
    },
    {
      "from": "cu-tpl-tracker",
      "to": "pg-templates",
      "label": "PlanningHoursDatas + RCR + paid leaves",
      "mode": "sync",
      "crud": ["update"]
    },
    {
      "from": "pg-templates",
      "to": "svc-search",
      "label": "DMS CDC → raw_shifts replica",
      "mode": "async-event"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-templates",
      "type": "postgresql",
      "label": "skello_production — templates + shifts",
      "description": "Template snapshots and the shifts created from them"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-templates",
      "label": "templates + created shifts",
      "crud": ["create", "read", "update"]
    }
  ]
})

export default planning_template
