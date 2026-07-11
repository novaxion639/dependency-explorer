import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const svc_modularisation: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "svc-modularisation",
  "type": "typescript-microservice",
  "description": "Feature module configuration — controls which product modules are enabled per account",
  "endpoints": [
    {
      "id": "api-get-modularisation",
      "path": "/modularisation",
      "method": "GET",
      "description": "Get modularisation configuration",
      "useCase": "Used by calling services to get modularisation configuration",
      "params": [],
      "response": {
        "200": "Success response",
        "404": "Not found"
      },
      "awsCalls": [
        {
          "type": "dynamodb",
          "name": "svcModularisation-{env}"
        }
      ]
    }
  ],
  "databases": [
    {
      "type": "dynamodb",
      "name": "svcModularisation-{env}",
      "description": "Module activation flags per shop and organisation"
    }
  ]
})

export default svc_modularisation
