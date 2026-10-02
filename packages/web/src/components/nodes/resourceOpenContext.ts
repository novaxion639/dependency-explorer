import { createContext } from 'react'

export const ResourceOpenContext = createContext<(id: string) => void>(() => {})

export function nodeResources(data: Record<string, unknown>): string[] {
  const resources = data.resources
  return Array.isArray(resources) ? resources.filter((r): r is string => typeof r === 'string') : []
}
