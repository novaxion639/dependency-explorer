import { resourceIdForDatabase, type ConnectivityService, type Resource, type ServiceType } from '@dependency-explorer/data'
import { fitLabel, linesHeight } from '../geometry'
import type { DiagramNode } from '../model'
import { SUBJECT_ID } from './ids'

const TYPE_LABEL: Record<ServiceType, string> = {
  'typescript-microservice': 'TypeScript service',
  'rails-microservice': 'Rails service',
  'rails-monolith': 'Rails monolith',
  'vue-frontend': 'Web front end',
  'react-native': 'React Native app',
}

export function subjectCard(service: ConnectivityService, resources: Resource[], width: number, fontSize: number): DiagramNode {
  const stores = (service.databases ?? []).map(db => {
    const resource = resourceIdForDatabase(service.name, db, resources)
    return { label: fitLabel(`▤ ${db.name}`, width, fontSize), ...(resource ? { resource } : {}) }
  })
  const detail = [TYPE_LABEL[service.type], `${service.endpoints.length} endpoints`]
  return {
    id: SUBJECT_ID, kind: 'subject', label: fitLabel(service.name, width, fontSize), detail, stores, fontSize,
    x: 0, y: 0, w: width, h: linesHeight(1 + detail.length + stores.length, fontSize), ref: { type: 'service', name: service.name },
  }
}
