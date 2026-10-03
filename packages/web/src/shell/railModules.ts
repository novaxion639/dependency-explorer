import type { Page } from '../hooks/useUrlState'

export interface RailItem { label: string; hint: string; page?: Page; children?: RailItem[] }
export interface RailGroup { title: string; items: RailItem[] }

export const RAIL: RailGroup[] = [
  {
    title: 'Understand',
    items: [
      { label: 'Product areas', hint: 'What Skello does, where', page: 'areas' },
      {
        label: 'Architecture',
        hint: 'What talks to what',
        children: [
          { label: 'Monolith', hint: 'skello-app by area', page: 'monolith' },
          { label: 'Microservices', hint: 'services by area', page: 'microservices' },
        ],
      },
      { label: 'Flows', hint: 'How a feature runs', page: 'flows' },
    ],
  },
  {
    title: 'Change',
    items: [
      { label: 'Resources', hint: 'Tables, queues, buckets', page: 'resources' },
      { label: 'Impact', hint: 'If X is down', page: 'impact' },
    ],
  },
  { title: 'People', items: [{ label: 'Ownership', hint: 'Who owns what', page: 'ownership' }] },
]
