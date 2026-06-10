import type { ServiceConnection } from '@dependency-explorer/schema'

/** Re-serialize connections.ts in the established materializer format. */
export function serializeConnectionsFile(connections: ServiceConnection[]): string {
  const ordered = connections.map(c => ({
    from: c.from,
    to: c.to,
    sdkPackage: c.sdkPackage,
    communicationType: c.communicationType,
    protocol: c.protocol,
    authType: c.authType,
    description: c.description,
    usedEndpoints: c.usedEndpoints,
  }))
  return `import { ServiceConnectionSchema } from '@dependency-explorer/schema'
import type { ServiceConnection } from '@dependency-explorer/schema'
import { z } from 'zod'

/**
 * Service-to-service connections.
 * communicationType / protocol / authType are explicit on every entry —
 * never inferred from sdkPackage naming (ADR-0004).
 */
const connections: ServiceConnection[] = z.array(ServiceConnectionSchema).parse(${JSON.stringify(ordered, null, 2)})

export default connections
`
}
