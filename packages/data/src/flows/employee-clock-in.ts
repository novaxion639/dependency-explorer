import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory candidate #2 (time clock — previously a zero-flow domain).
// Traced 2026-06-15: punch_clock/v1/badgings_controller.rb → badging_parser_job.rb
// → badging_parser.rb → microservices/punch/ms_badging.rb. The physical punch
// clock (SkelloPunchClock tablet app — outside the map per the GLOBAL board)
// posts raw punch events; a mobile clock-in path exists separately via
// Microservices::Punch::ClockInOutService.
const employee_clock_in: ServiceFlow = ServiceFlowSchema.parse({
  "id": "employee-clock-in",
  "name": "Employee Clock-In (Punch Clock)",
  "description": "An employee badges in/out on the shop's punch clock tablet (SkelloPunchClock app, outside the map). The monolith's punch_clock/v1 API accepts the raw punch payload and returns immediately — parsing is asynchronous: BadgingParserJob runs BadgingParser, which reads the shop's punch settings from svc-punch, pairs in/out and pause events into Badging rows in PostgreSQL, and mirrors in-progress ('fake') badgings into svc-punch so the punch domain service holds the live state. Managers later reconcile badgings against planned shifts in the badgings section (v3/api/badgings matched/day controllers — a separate review flow).",
  "steps": [
    {
      "from": "skello-app",
      "to": "svc-punch",
      "action": "Read punch settings (Punch::SettingService) + mirror parsed badgings (Punch::MsBadging.create_or_update_fake_badging)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ci-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "PunchClock::V1::BadgingsController#update",
      "path": "app/controllers/punch_clock/v1/badgings_controller.rb",
      "description": "Punch clock device API — accepts the raw punch payload, enqueues the parser, responds empty immediately (the tablet never waits); also serves yesterday's backend-closed badgings back to devices"
    },
    {
      "id": "cu-ci-parser-job",
      "service": "skello-app",
      "kind": "job",
      "label": "BadgingParserJob",
      "path": "app/jobs/badging_parser_job.rb",
      "description": "Sidekiq — replays the raw payload into BadgingParser out-of-request"
    },
    {
      "id": "cu-ci-parser",
      "service": "skello-app",
      "kind": "service",
      "label": "BadgingParser",
      "path": "app/services/badging_parser.rb",
      "description": "Pairs punch events into badgings (in/out, pause_start/pause_end pairs, matching pauses to previous badges), persists Badging rows, and mirrors in-progress badgings to svc-punch"
    },
    {
      "id": "cu-ci-ms-badging",
      "service": "skello-app",
      "kind": "service",
      "label": "Microservices::Punch::MsBadging",
      "path": "app/services/microservices/punch/ms_badging.rb",
      "description": "HTTP client mirroring 'fake' (in-progress) badgings into svc-punch — create_or_update_fake_badging / update_fake_badging"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-ci-controller",
      "to": "cu-ci-parser-job",
      "label": "raw punch payload",
      "mode": "async-job"
    },
    {
      "from": "cu-ci-controller",
      "to": "svc-punch",
      "label": "Punch::SettingService.get — shop punch settings",
      "mode": "sync"
    },
    {
      "from": "cu-ci-parser-job",
      "to": "cu-ci-parser",
      "label": "parse punches",
      "mode": "sync"
    },
    {
      "from": "cu-ci-parser",
      "to": "pg-skello-badgings",
      "label": "Badging rows (in/out + pause pairs)",
      "mode": "sync",
      "crud": ["create", "update"]
    },
    {
      "from": "cu-ci-parser",
      "to": "cu-ci-ms-badging",
      "label": "mirror in-progress badgings",
      "mode": "sync"
    },
    {
      "from": "cu-ci-ms-badging",
      "to": "svc-punch",
      "label": "create_or_update_fake_badging",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-badgings",
      "type": "postgresql",
      "label": "skello_production — badgings",
      "description": "Badging rows paired from raw punches; later reconciled against shifts by managers (shift-update unlinks badging on unassign — the coupling seen in the shift-update flow)"
    },
    {
      "id": "redis-skello-badgings",
      "type": "redis",
      "label": "skello-redis",
      "description": "Sidekiq broker for BadgingParserJob"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-badgings",
      "label": "persist badgings",
      "crud": ["create", "update"]
    },
    {
      "from": "skello-app",
      "to": "redis-skello-badgings",
      "label": "enqueue parser"
    }
  ]
})

export default employee_clock_in
