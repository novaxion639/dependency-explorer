import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const bff_dashboard_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "bff-dashboard-load",
  "name": "BFF Dashboard Aggregation",
  "description": "The frontend requests dashboard data. The main BFF fans out to svc-kpis-v2, svc-documents-v2, and svc-intelligence, then aggregates the responses.",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff",
      "action": "GET /dashboard — request dashboard data"
    },
    {
      "from": "svc-bff",
      "to": "svc-kpis-v2",
      "action": "GET /kpis — fetch activity KPIs"
    },
    {
      "from": "svc-bff",
      "to": "svc-documents-v2",
      "action": "GET /documents — fetch recent documents"
    },
    {
      "from": "skello-app-front",
      "to": "svc-intelligence",
      "action": "GET /analyse — load workforce insights"
    }
  ],
  "infraNodes": [
    {
      "id": "pg-kpis",
      "type": "postgresql",
      "label": "kpis-db",
      "description": "KPI time-series data"
    },
    {
      "id": "kinesis-kpis",
      "type": "kinesis",
      "label": "kpis-stream",
      "description": "Real-time KPI event stream"
    },
    {
      "id": "mongo-intelligence",
      "type": "mongodb",
      "label": "intelligence-db",
      "description": "Workforce analytics store"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-kpis-v2",
      "to": "pg-kpis",
      "label": "read",
      "crud": ["read"]
    },
    {
      "from": "svc-kpis-v2",
      "to": "kinesis-kpis",
      "label": "consume"
    },
    {
      "from": "svc-intelligence",
      "to": "mongo-intelligence",
      "label": "read",
      "crud": ["read"]
    }
  ]
})

export default bff_dashboard_load
