import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

const bff_dashboard_load: ServiceFlow = ServiceFlowSchema.parse({
  "id": "bff-dashboard-load",
  "name": "BFF Dashboard Aggregation",
  "description": "The frontend requests dashboard data. The main BFF fans out to svc-kpis-v2 and svc-documents-v2, then aggregates the responses. (Corrected 2026-06-10: endpoint paths aligned with the deployed BFF API — POST /v1/kpis; a previously documented svc-intelligence 'workforce insights' call had no evidence and was removed.)",
  "steps": [
    {
      "from": "skello-app-front",
      "to": "svc-bff",
      "action": "POST /v1/kpis — request aggregated dashboard KPIs"
    },
    {
      "from": "svc-bff",
      "to": "svc-kpis-v2",
      "action": "POST /kpis — compute activity KPIs"
    },
    {
      "from": "svc-bff",
      "to": "svc-documents-v2",
      "action": "GET /documents — fetch recent documents"
    }
  ],
  "infraNodes": [
    {
      "id": "mongo-kpis",
      "type": "mongodb",
      "label": "SvcKpisV2 (VPC MongoDB)",
      "description": "KPI collections — kpisManual, settingActivityPrediction, settingsDisplayMetrics. (Corrected 2026-06-10 per the svcKpisV2 architecture board: the previously documented PostgreSQL kpis-db and consumed Kinesis stream do not exist — realtime fan-out is EventBridge, produced by the service.)"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-kpis-v2",
      "to": "mongo-kpis",
      "label": "read",
      "crud": ["read"]
    }
  ]
})

export default bff_dashboard_load
