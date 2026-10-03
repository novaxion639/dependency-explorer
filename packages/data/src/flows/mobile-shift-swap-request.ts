import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18. The EMPLOYEE swap-request lifecycle is
// mobile-only: the web has no employee-initiated swap at all (only a manager
// drag-and-drop reassignment on the planning grid, persisted as a plain shift
// PATCH). The applied swap itself is the shift-swap flow (a shift update with
// event tracking).
const mobile_shift_swap_request: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mobile-shift-swap-request",
  "name": "Shift Swap Request (Mobile-Only)",
  "description": "An employee proposes a shift swap from the phone — a lifecycle the WEB DOES NOT HAVE (client divergence: web offers only manager drag-and-drop reassignment). Screens still live in the legacy v2 stack: browse swappable shifts, create the request (POST /api/v2/shifts/:shiftId/shift_swaps), the target employee sees it in the requests hub (GET /api/v1/requests/received) and accepts/refuses (PATCH /api/v2/shift_swaps/:id). Everything runs through the monolith's api/v2 surface; ShiftSwap rows live in monolith PostgreSQL, and V3::Shifts::UpdateService destroys pending ShiftSwaps when the underlying shift is reassigned or changes day (the same remove_dependencies that unlinks badgings). Acceptance applies the swap as a shift update — the shift-swap flow's code layer covers that server side.",
  "trigger": {"actor": "employee"},
  "primaryArea": "leave-requests",
  "chapters": [
    { "title": "An employee proposes a swap", "summary": "From the phone, the employee picks a swappable shift and sends the request; the web has no such screen.", "refs": ["skello-mobile", "cu-mss-new", "skello-app"] },
    { "title": "The swap is recorded", "summary": "skello-app stores the swap request in its own database.", "refs": ["cu-mss-controller", "pg-skello-swaps"] },
    { "title": "The colleague answers", "summary": "The colleague sees it among their requests and accepts or refuses; acceptance applies the swap as a shift update.", "refs": ["cu-mss-hub", "cu-mss-received", "cu-mss-controller"] },
    { "title": "Stale swaps disappear", "summary": "When the shift is reassigned or changes day, skello-app deletes its pending swaps.", "refs": ["skello-app", "pg-skello-swaps"] }
  ],
  "links": [{"to": "shift-swap", "kind": "domain-related", "note": "employee-initiated swap lifecycle (legacy api/v2); the web flow is manager drag-drop only"}],
  "steps": [
    {
      "from": "skello-mobile",
      "to": "skello-app",
      "action": "Swap lifecycle on legacy api/v2 (create request, list sent/received, accept/refuse) — ShiftSwap rows in monolith PostgreSQL"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mss-hub",
      "service": "skello-mobile",
      "kind": "component",
      "label": "Requests hub (sent / received)",
      "path": "src/screens/Requests/Requests.tsx",
      "description": "GET /api/v1/requests/sent — the entry point where swap (and leave) requests surface"
    },
    {
      "id": "cu-mss-new",
      "service": "skello-mobile",
      "kind": "component",
      "label": "swap request screen (legacy v2)",
      "path": "src/v2/screens/ShiftSwapNew/index.js",
      "description": "Browse swappable shifts (GET /api/v2/shifts/:shiftId/shift_swaps/new) and create the request"
    },
    {
      "id": "cu-mss-received",
      "service": "skello-mobile",
      "kind": "component",
      "label": "swap request screen (accept / refuse)",
      "path": "src/v2/screens/ShiftSwapEdit/index.js",
      "description": "One received swap request: GET /api/v2/shift_swaps/:id/edit, then accept or refuse with PATCH /api/v2/shift_swaps/:id; the list itself comes from ShiftSwapRequests (GET /api/v2/shift_swaps?shop_id)"
    },
    {
      "id": "cu-mss-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "Api::V2::ShiftSwapsController",
      "path": "app/controllers/api/v2/shift_swaps_controller.rb",
      "description": "The swap lifecycle surface — acceptance applies the swap as a shift update (shift-swap flow's server-side layer)"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-mss-hub",
      "to": "skello-app",
      "label": "GET /api/v1/requests/sent",
      "mode": "sync"
    },
    {
      "from": "cu-mss-new",
      "to": "skello-app",
      "label": "create swap request (api/v2)",
      "mode": "sync"
    },
    {
      "from": "cu-mss-received",
      "to": "skello-app",
      "label": "accept / refuse (PATCH api/v2/shift_swaps/:id)",
      "mode": "sync"
    },
    {
      "from": "skello-app",
      "to": "cu-mss-controller",
      "label": "api/v2 shift_swaps routes",
      "mode": "sync"
    },
    {
      "from": "cu-mss-controller",
      "to": "pg-skello-swaps",
      "label": "ShiftSwap rows",
      "mode": "sync",
      "crud": ["create", "update", "delete"]
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-swaps",
      "type": "postgresql",
      "label": "skello_production — shift_swaps",
      "resources": ["pg:skello_production.shift_swaps"],
      "description": "Pending swaps; destroyed by V3::Shifts::UpdateService#remove_dependencies when the shift is reassigned or changes opening-window day"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-swaps",
      "label": "swap lifecycle",
      "crud": ["create", "update", "delete"]
    }
  ]
})

export default mobile_shift_swap_request
