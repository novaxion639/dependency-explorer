import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_search: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-search",
  "type": "typescript-microservice",
  "description": "Full-text and faceted search across employees, shops, shifts and documents",
  "endpoints": [],
  "databases": [
    {
      "type": "mongodb",
      "name": "svc-search",
      "description": "Search indexes and cached query results"
    },
    {
      "type": "s3",
      "name": "skello-app.shifts-full-load.{env}",
      "description": "Bulk index snapshots and export files"
    }
  ]
})

export default svc_search
