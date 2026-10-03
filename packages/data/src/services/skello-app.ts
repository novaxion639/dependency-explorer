import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const skello_app: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "skello-app",
  "type": "rails-monolith",
  "description": "Core Rails monolith — the main backend serving the Vue frontend, handling scheduling, payroll, HR and billing",
  "endpoints": [],
  "databases": [
    {
      "type": "postgresql",
      "name": "skello_production",
      "description": "Main relational database — all core Skello data"
    },
    {
      "type": "redis",
      "name": "skelloApp-valkey-{env}",
      "description": "Sidekiq job queues, session store and caching"
    },
    {
      "type": "dynamodb",
      "name": "svcUsers-{env}",
      "description": "svc-users table — API access keys read by AccessKeyService (SVC_USERS_DYNAMO_TABLE_NAME)"
    }
  ]
})

export default skello_app
