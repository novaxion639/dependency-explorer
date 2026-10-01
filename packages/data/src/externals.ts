import { ExternalSystemSchema } from '@dependency-explorer/schema'
import type { ExternalSystem } from '@dependency-explorer/schema'
import { z } from 'zod'

const externals: ExternalSystem[] = z.array(ExternalSystemSchema).parse([
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payment',
    description: 'Card and SEPA payments behind the monolith subscription billing',
    usedBy: [{ service: 'skello-app', evidence: { kind: 'gem', literal: 'stripe' } }],
  },
  {
    id: 'chargebee',
    name: 'Chargebee',
    category: 'payment',
    description: 'Subscription and invoice management for automated billing',
    usedBy: [{ service: 'svc-billing-automation', evidence: { kind: 'npm', literal: 'chargebee-typescript' } }],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description: 'Sales CRM — receives self-serve, upsell and billing-status updates',
    usedBy: [
      { service: 'skello-app', evidence: { kind: 'env', literal: 'SALESFORCE_BASE_URL' } },
      { service: 'svc-billing-automation', evidence: { kind: 'env', literal: 'SALESFORCE_API_KEY' } },
      { service: 'svc-users', evidence: { kind: 'env', literal: 'SALESFORCE_API_KEY' } },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'other',
    description: 'Automation webhooks for cash recovery, new shops and upsells',
    usedBy: [
      { service: 'skello-app', evidence: { kind: 'env', literal: 'ORGANISATION_ZAPIER_URL' } },
      { service: 'svc-billing-automation', evidence: { kind: 'env', literal: 'ZAPIER_UPSELL_URL' } },
    ],
  },
  {
    id: 'insee',
    name: 'INSEE Sirene',
    category: 'other',
    description: 'French company registry lookup during billing setup',
    usedBy: [{ service: 'svc-billing-automation', evidence: { kind: 'env', literal: 'INSEE_API_ACCESS_TOKEN' } }],
  },
  {
    id: 'yousign',
    name: 'Yousign',
    category: 'e-signature',
    description: 'Electronic signature of contracts, amendments and attendance sheets',
    usedBy: [
      { service: 'svc-documents-esignature', evidence: { kind: 'env', literal: 'YOUSIGN_API_TOKEN' } },
      { service: 'svc-documents-v2', evidence: { kind: 'env', literal: 'YOUSIGN_API_TOKEN' } },
    ],
  },
  {
    id: 'brevo',
    name: 'Brevo',
    category: 'messaging',
    description: 'Transactional email delivery and its delivery webhooks',
    usedBy: [
      { service: 'svc-communications-v2', evidence: { kind: 'npm', literal: '@getbrevo/brevo' } },
      { service: 'svc-users', evidence: { kind: 'env', literal: 'BREVO_WEBHOOK_API_KEY' } },
    ],
  },
  {
    id: 'expo-push',
    name: 'Expo push',
    category: 'messaging',
    description: 'Push notifications to the mobile app',
    usedBy: [{ service: 'svc-communications-v2', evidence: { kind: 'env', literal: 'EXPO_ACCESS_TOKEN' } }],
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'messaging',
    description: 'In-app customer support chat on web and mobile',
    usedBy: [
      { service: 'skello-app', evidence: { kind: 'env', literal: 'INTERCOM_TOKEN' } },
      { service: 'skello-mobile', evidence: { kind: 'npm', literal: '@intercom/intercom-react-native' } },
    ],
  },
  {
    id: 'segment',
    name: 'Segment',
    category: 'other',
    description: 'Product analytics events from the mobile app',
    usedBy: [{ service: 'skello-mobile', evidence: { kind: 'npm', literal: '@segment/analytics-react-native' } }],
  },
  {
    id: 'metabase',
    name: 'Metabase',
    category: 'other',
    description: 'Embedded analytics dashboards',
    usedBy: [{ service: 'skello-app', evidence: { kind: 'env', literal: 'METABASE_SITE_URL' } }],
  },
  {
    id: 'urssaf',
    name: 'URSSAF DPAE',
    category: 'hris',
    description: 'Pre-hiring declarations (DPAE) deposited with the French social-security agency',
    usedBy: [{ service: 'svc-employees', evidence: { kind: 'env', literal: 'URSSAF_DEPOSIT_BASE_URL' } }],
  },
  {
    id: 'join',
    name: 'JOIN',
    category: 'ats',
    description: 'Applicant tracking system behind Skello hiring',
    usedBy: [{ service: 'svc-hiring', evidence: { kind: 'env', literal: 'JOIN_API_BASE_URL' } }],
  },
  {
    id: 'kombo',
    name: 'Kombo',
    category: 'payroll',
    description: 'Unified HRIS/payroll API — employee pull and payroll passthrough (PayFit, Silae…)',
    usedBy: [
      { service: 'svc-hris', evidence: { kind: 'env', literal: 'KOMBO_API_KEY' } },
      { service: 'svc-payroll', evidence: { kind: 'env', literal: 'KOMBO_API_KEY' } },
    ],
  },
  {
    id: 'zelty',
    name: 'Zelty',
    category: 'pos',
    description: 'POS revenue pulled by the monolith for forecasting',
    usedBy: [{ service: 'skello-app', evidence: { kind: 'env', literal: 'ZELTY_BASE_URL' } }],
  },
  {
    id: 'laddition',
    name: "L'Addition",
    category: 'pos',
    description: 'POS revenue polled by svc-pos',
    usedBy: [{ service: 'svc-pos', evidence: { kind: 'host', literal: 'api.laddition.com' } }],
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    category: 'other',
    description: 'LLM provider for the Skello assistant',
    usedBy: [{ service: 'svc-skello-assistant', evidence: { kind: 'env', literal: 'ANTHROPIC_API_KEY' } }],
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    category: 'other',
    description: 'Hosted LLM inference for document analysis, the assistant and email generation',
    usedBy: [
      { service: 'svc-intelligence', evidence: { kind: 'env', literal: 'BEDROCK_INFERENCE_PROFILE_ARN' } },
      { service: 'svc-skello-assistant', evidence: { kind: 'env', literal: 'BEDROCK_CLAUDE_HAIKU_INFERENCE_PROFILE_ARN' } },
      { service: 'svc-communications-v2', evidence: { kind: 'env', literal: 'BEDROCK_CLAUDE_HAIKU_INFERENCE_PROFILE_ARN' } },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'messaging',
    description: 'Operational alert webhooks',
    usedBy: [
      { service: 'svc-automatic-scheduling', evidence: { kind: 'env', literal: 'SLACK_WEBHOOK_TOKEN' } },
      { service: 'svc-documents-v2', evidence: { kind: 'env', literal: 'SLACK_WEBHOOK_TOKEN' } },
      { service: 'svc-feature-flags', evidence: { kind: 'env', literal: 'SLACK_WEBHOOK_TOKEN' } },
    ],
  },
])

export default externals
