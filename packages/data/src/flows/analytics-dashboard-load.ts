import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Flow inventory follow-up (analytics domain). Traced 2026-06-15 — and it
// settled a long-standing unknown target: @skelloapp/skello-analytics-client
// is instantiated with skelloApiUrl (AnalyticsDashboard.vue:383), i.e. the
// MONOLITH, not a separate analytics service. First flow with a FRONT-side
// code unit. The legacy-KPI double-client finding from the same trace lives
// on the svc-kpis service adopted alongside this flow.
const analytics_dashboard_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "analytics-dashboard-load",
  "name": "Analytics Dashboard Load",
  "description": "A manager opens the analytics dashboard (commercial/KPI cards over a date range). The Vue section instantiates SkelloAnalyticsClient against the MONOLITH's API (skelloApiUrl) and pulls all metrics in one getAllMetrics call — KPI computation happens in-process in the monolith over its PostgreSQL data (candidate serving surfaces: v3/api/dashboards and the token-gated public/kpis/v1 API with Public::Kpis::V1::KpisComputeService; the exact route is inside the closed-source analytics client). Not to be confused with the home dashboard (bff-dashboard-load → svc-kpis-v2) or the planning KPIs row (dual v1+v2 clients — see svc-kpis).",
  "trigger": {"actor": "manager"},
  "links": [{"to": "bff-dashboard-load", "kind": "domain-related", "note": "sibling dashboard surface; this one still rides the legacy svcKpis client"}],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "getAllMetrics over the selected date range (SkelloAnalyticsClient → skelloApiUrl)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-ad-page",
      "service": "skello-app-front",
      "kind": "controller",
      "label": "AnalyticsDashboard.vue",
      "path": "apps/vue-app/src/analytics_dashboard/AnalyticsDashboard.vue",
      "description": "The analytics section root — instantiates SkelloAnalyticsClient(skelloApiUrl), fetches on mount/date-range change (analyticsMaximumMonthsRange guard), feeds the analytics-dashboard store"
    }
  ],
  "codeEdges": [
    {
      "from": "skello-app-front",
      "to": "cu-ad-page",
      "label": "open analytics section",
      "mode": "sync"
    },
    {
      "from": "cu-ad-page",
      "to": "skello-app",
      "label": "getAllMetrics (date range)",
      "mode": "sync"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-analytics",
      "type": "postgresql",
      "label": "skello_production",
      "description": "KPI source data — metrics computed in-process by the monolith"
    }
  ],
  "infraEdges": [
    {
      "from": "skello-app",
      "to": "pg-skello-analytics",
      "label": "compute metrics",
      "crud": ["read"]
    }
  ]
})

export default analytics_dashboard_load
