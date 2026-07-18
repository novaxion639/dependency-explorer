import { DomainSchema } from '@dependency-explorer/schema'
import type { Domain } from '@dependency-explorer/schema'
import { z } from 'zod'

const domains: Domain[] = z.array(DomainSchema).parse([
  {
    id: 'scheduling',
    name: 'Scheduling',
    description: 'Shift planning, automatic scheduling, workload plans, and labour law compliance',
    color: '#3b82f6',
    serviceNames: [
      'svc-shifts',
      'svc-bff-planning',
      'svc-automatic-scheduling',
      'svc-workload-plan',
      'svc-labour-laws',
    ],
    dataEntities: ['Shift', 'Absence', 'WorkloadPlan', 'PlanningPeriod'],
    publishedEvents: ['shift.created', 'shift.updated', 'shift.deleted', 'absence.created'],
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employee management, HRIS sync, documents, e-signatures, and leave requests',
    color: '#8b5cf6',
    serviceNames: [
      'svc-employees',
      'svc-hiring',
      'svc-hris',
      'svc-documents-v2',
      'svc-documents-esignature',
      'svc-requests',
      'svc-payroll',
    ],
    dataEntities: ['Employee', 'Contract', 'Document', 'LeaveRequest'],
    publishedEvents: ['employee.created', 'employee.updated', 'document.signed', 'request.approved'],
  },
  {
    id: 'communications',
    name: 'Communications',
    description: 'Event bus, email/push/SMS notifications, and domain event routing',
    color: '#f59e0b',
    serviceNames: [
      'svc-events',
      'svc-communications-v2',
    ],
    dataEntities: ['DomainEvent', 'Notification'],
    publishedEvents: ['notification.sent'],
    consumedEvents: ['shift.created', 'shift.updated', 'employee.created', 'request.approved'],
  },
  {
    id: 'billing',
    name: 'Billing',
    description: 'Subscription management, invoicing, quotes, and enrollment flows',
    color: '#10b981',
    serviceNames: [
      'svc-billing-automation',
      'svc-enrollment',
    ],
    dataEntities: ['Subscription', 'Invoice', 'Quote'],
    publishedEvents: ['subscription.created', 'invoice.generated'],
  },
  {
    id: 'time-attendance',
    name: 'Time & Attendance',
    description: 'Clock-in/out tracking, timesheets, POS integration, and time trackers',
    color: '#ec4899',
    serviceNames: [
      'svc-punch',
      'svc-trackers',
      'svc-pos',
      'skello-punchclock',
    ],
    dataEntities: ['Punch', 'Timesheet', 'PosTransaction'],
    publishedEvents: ['punch.created', 'tracker.updated'],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    description: 'KPIs, analytics, AI assistant, and reporting insights',
    color: '#06b6d4',
    serviceNames: [
      'svc-intelligence',
      'svc-skello-assistant',
      'svc-kpis',
      'svc-kpis-v2',
      'svc-reports',
    ],
    dataEntities: ['KPI', 'Report', 'Insight'],
  },
  {
    id: 'platform',
    name: 'Platform',
    description: 'Cross-cutting services: search, feature flags, user management, BFF, and modularization',
    color: '#64748b',
    serviceNames: [
      'svc-search',
      'svc-feature-flags',
      'svc-users',
      'svc-modularisation',
      'svc-bff',
      'svc-shops',
      'svc-websockets',
      'svc-websockets-v2',
    ],
    dataEntities: ['User', 'Shop', 'FeatureFlag'],
  },
  {
    id: 'core',
    name: 'Core',
    description: 'Rails monolith, Vue frontend, mobile app, and admin tools — the core clients and legacy heart of the system',
    color: '#ef4444',
    serviceNames: [
      'skello-app',
      'skello-app-front',
      'skello-mobile',
      'superadmin',
    ],
    dataEntities: ['AllLegacyModels'],
  },
])

export default domains
