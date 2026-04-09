import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

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
      "name": "svc-search.{env}",
      "description": "Bulk index snapshots and export files"
    },
    {
      "type": "sqs",
      "name": "svc-search-index-dlq",
      "description": "Failed index update retry queue"
    }
  ]
})

export default svc_search
