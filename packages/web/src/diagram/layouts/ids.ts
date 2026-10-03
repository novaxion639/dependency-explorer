export const CLIENTS_ID = 'band:clients'
export const MONOLITH_ID = 'band:monolith'
export const PLATFORM_ID = 'band:platform'
export const SUBJECT_ID = 'subject'

export function areaId(id: string): string {
  return `area:${id}`
}

export function serviceId(name: string): string {
  return `svc:${name}`
}
