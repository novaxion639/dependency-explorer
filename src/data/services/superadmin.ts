import { ConnectivityServiceSchema } from '../schemas'
import type { ConnectivityService } from '../schemas'

const superadmin: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "superadmin",
  "type": "vue-frontend",
  "description": "Internal admin dashboard for Skello operators — manages billing, organisations, employees and platform configuration",
  "endpoints": []
})

export default superadmin
