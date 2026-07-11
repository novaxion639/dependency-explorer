import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const skello_app_front: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "skello-app-front",
  "type": "vue-frontend",
  "description": "Main Vue 2 frontend — scheduling, HR, reports, requests and planning for Skello operators",
  "endpoints": []
})

export default skello_app_front
