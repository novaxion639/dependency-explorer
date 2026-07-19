import type { ServiceFlow, Domain } from '@dependency-explorer/schema'

/**
 * Domains a flow touches — transitive via the services its steps name
 * (DomainSchema has no flows field). Shared by the web flow list and the
 * docs generator so the attribution logic exists exactly once.
 */
export function getFlowDomains(flow: ServiceFlow, domains: Domain[]): Domain[] {
  const serviceNames = new Set<string>()
  for (const step of flow.steps) {
    serviceNames.add(step.from.replace(/ \([^)]*\)$/, ''))
    serviceNames.add(step.to.replace(/ \([^)]*\)$/, ''))
  }
  return domains.filter(d => d.serviceNames.some(s => serviceNames.has(s)))
}
