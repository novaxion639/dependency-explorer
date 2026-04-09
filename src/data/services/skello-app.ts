import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

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
      "name": "skello-redis",
      "description": "Sidekiq job queues, session store and caching"
    },
    {
      "type": "dynamodb",
      "name": "skello-dynamodb",
      "description": "DynamoDB for high-throughput writes"
    },
    {
      "type": "s3",
      "name": "skello-assets.{env}",
      "description": "User-uploaded files, documents and media"
    },
    {
      "type": "sqs",
      "name": "skello-sqs-events",
      "description": "Async SQS messages to/from microservices"
    }
  ]
})

export default skello_app
