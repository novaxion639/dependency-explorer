import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_kpis: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-kpis",
  "type": "typescript-microservice",
  "description": "LEGACY KPI service (v1), superseded by svc-kpis-v2 for metric computation but STILL LIVE in the front (adopted 2026-06-15 from the flow inventory): the planning KPIs store reads/writes user KPI display settings through svc_kpis_client (getUserKpiSettings / patchUserKpiSettings) side by side with the v2 client, and base-app ships a SvcKpis client (KpisForDateModel). The GLOBAL architecture board marks SvcKpis deprecated — these v1 call sites must migrate before decommission.",
  "tags": ["decommission-watch"],
  "endpoints": [],
  "databases": [
    {
      "type": "postgresql",
      "name": "svc-kpis",
      "description": "Own Postgres replica of monolith tables (10 TypeORM entities: shops, users, contracts, weekly options, predicted shifts, postes…) fed by the skelloapp-bus CDC consumption — the data KPI settings and v1 computations read. Surfaced by the AWS client-usage discovery pass, 2026-07-11."
    },
    {
      "type": "kinesis",
      "name": "skelloapp-bus-{env}",
      "description": "Consumed CDC backbone stream; KinesisReplayService additionally replays failed DLQ batches back onto the stream (putRecords). Surfaced by the AWS client-usage discovery pass, 2026-07-11."
    }
  ]
})

export default svc_kpis
