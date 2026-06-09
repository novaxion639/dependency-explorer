import type { ConnectivityMap } from '../data/schemas'

export interface BlastRadiusResult {
  /** Map of service name -> hop distance from the origin */
  affected: Map<string, number>
  /** Total number of affected services (excluding the origin) */
  count: number
}

/**
 * Compute the blast radius of a service failure.
 * Traverses the connection graph BFS-style up to `maxDepth` hops,
 * following BOTH directions (services that call this one are affected
 * when it goes down, and services this one calls may also be impacted).
 */
export function computeBlastRadius(
  map: ConnectivityMap,
  serviceName: string,
  maxDepth: number = 2,
): BlastRadiusResult {
  // Build adjacency list (both directions — if A calls B and B is down, A is affected)
  const neighbors = new Map<string, Set<string>>()
  for (const conn of map.connections) {
    if (!neighbors.has(conn.from)) neighbors.set(conn.from, new Set())
    if (!neighbors.has(conn.to)) neighbors.set(conn.to, new Set())
    neighbors.get(conn.from)!.add(conn.to)
    neighbors.get(conn.to)!.add(conn.from)
  }

  const affected = new Map<string, number>()
  const queue: Array<[string, number]> = [[serviceName, 0]]
  affected.set(serviceName, 0)

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!
    if (depth >= maxDepth) continue

    const adjacents = neighbors.get(current)
    if (!adjacents) continue

    for (const neighbor of adjacents) {
      if (!affected.has(neighbor)) {
        affected.set(neighbor, depth + 1)
        queue.push([neighbor, depth + 1])
      }
    }
  }

  // Remove the origin service from the count
  affected.delete(serviceName)

  return { affected, count: affected.size }
}
