import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18. The phone drives the SAME v3 planning
// surface as the web — the monolith-side code layer is the shift-creation /
// shift-update flows'; this flow documents the mobile client side and its
// overnight handling.
const mobile_planning_management: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mobile-planning-management",
  "name": "Mobile Planning — Consultation & Shift Management",
  "description": "Employees consult their planning and managers manage shifts from the phone, on the SAME monolith v3 surface the web uses (server-side code layer: shift-creation / shift-update flows). Employee view reads /v3/api/users/:id/shifts; manager view reads /v3/api/plannings/{shifts,users} with team filters. Managers create/update/delete shifts (POST/PATCH/DELETE /v3/api/plannings/shifts), patch shift tasks and append comments, and can VALIDATE a period from the phone (POST /v3/api/weekly_options/validate_period — the same day-lock the badging review checks). OVERNIGHT handling is client-side and shop-hours-aware: fetch windows are padded +2 days ('to include shifts after midnight + 1 day not included by API'), and a planning 'day' renders as opening-time → next opening-time so post-midnight shifts appear on the prior day (getDayShiftsByShopRangeHours; closing ≤ opening rolls the range +1 day). Leave-request-form times normalize after-midnight input +1 day for over-midnight shops.",
  "trigger": {"actor": "employee (view) / manager (shift CRUD)"},
  "steps": [
    {
      "from": "skello-mobile",
      "to": "skello-app",
      "action": "Planning reads (users/:id/shifts, plannings/shifts+users, teams, weekly_options) + shift CRUD + period validation — same v3 surface as the web"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mpm-screen",
      "service": "skello-mobile",
      "kind": "component",
      "label": "Planning screen (my / team tabs)",
      "path": "src/screens/Planning/Planning.tsx",
      "description": "Employee my-planning + manager team planning with team filters; shift details open the form wrapper for managers"
    },
    {
      "id": "cu-mpm-form",
      "service": "skello-mobile",
      "kind": "component",
      "label": "shift form hooks (create/update/delete)",
      "path": "src/screens/Planning/ShiftFormWrapper/hooks/usePostShiftFormsToApi.ts",
      "description": "Manager shift mutations from the phone — create/update/delete plus task-status and comment patches"
    },
    {
      "id": "cu-mpm-api",
      "service": "skello-mobile",
      "kind": "service",
      "label": "shifts api (reads, mutations, weekly options)",
      "path": "src/modules/shifts/api.ts",
      "description": "fetchMyShifts / fetchShopShifts / createShift / updateShifts / deleteShift / fetchWeeklyOptions / validatePeriod — all monolith v3"
    },
    {
      "id": "cu-mpm-adapter",
      "service": "skello-mobile",
      "kind": "service",
      "label": "range adapter (+2 days for after-midnight shifts)",
      "path": "src/modules/shifts/adapter/adapter.ts",
      "description": "Pads every fetch window +2 days — the client-side guard that keeps overnight shifts visible; day rendering itself buckets opening-time → next opening-time from shop hours"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-mpm-screen",
      "to": "cu-mpm-api",
      "label": "planning reads",
      "mode": "sync"
    },
    {
      "from": "cu-mpm-form",
      "to": "cu-mpm-api",
      "label": "shift mutations + period validation",
      "mode": "sync"
    },
    {
      "from": "cu-mpm-api",
      "to": "cu-mpm-adapter",
      "label": "window padding + params",
      "mode": "sync"
    },
    {
      "from": "cu-mpm-api",
      "to": "skello-app",
      "label": "v3 plannings surface (same as web — shift-creation/update code layers apply)",
      "mode": "sync"
    }
  ]
})

export default mobile_planning_management
