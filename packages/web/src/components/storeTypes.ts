import type { DatabaseType } from '@dependency-explorer/data'

export const STORE_META: Record<DatabaseType, { label: string; icon: string }> = {
  postgresql: { label: 'PostgreSQL', icon: '🐘' },
  redis: { label: 'Redis', icon: '⚡' },
  dynamodb: { label: 'DynamoDB', icon: '◈' },
  mongodb: { label: 'MongoDB', icon: '🍃' },
  elasticsearch: { label: 'Elasticsearch', icon: '🔍' },
  s3: { label: 'S3', icon: '🗄' },
  sqs: { label: 'SQS', icon: '📨' },
  sns: { label: 'SNS', icon: '📣' },
  kinesis: { label: 'Kinesis', icon: '🌊' },
  lambda: { label: 'Lambda', icon: 'λ' },
  cdc: { label: 'CDC', icon: '⚡' },
  sqlite: { label: 'SQLite', icon: '📱' },
}
