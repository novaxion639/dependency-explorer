import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const superadmin: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "superadmin",
  "type": "vue-frontend",
  "description": "Internal admin dashboard for Skello operators — manages billing, organisations, employees and platform configuration",
  "endpoints": []
})

export default superadmin
