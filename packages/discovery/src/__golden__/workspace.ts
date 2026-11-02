import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SKELLO_APP = {
  'config/routes.rb': `Rails.application.routes.draw do
  resources :shifts, only: [:index] do
    member do
      post :approve
    end
  end
end
`,
  'db/schema.rb': `ActiveRecord::Schema[7.1].define(version: 2026_11_01_000000) do
  create_table "shifts", force: :cascade do |t|
    t.bigint "shop_id"
    t.boolean "approved"
  end

  create_table "shops", force: :cascade do |t|
    t.string "name"
  end
end
`,
  'app/models/shift.rb': `class Shift < ApplicationRecord
  belongs_to :shop, touch: true

  after_commit :sync_shift, on: :create

  def sync_shift
    ShiftSyncJob.perform_later(id)
  end
end
`,
  'app/models/shop.rb': `class Shop < ApplicationRecord
  has_many :shifts
end
`,
  'app/jobs/shift_sync_job.rb': `class ShiftSyncJob < ApplicationJob
  def perform(id)
    id
  end
end
`,
  'app/controllers/shifts_controller.rb': `class ShiftsController < ApplicationController
  def index
    render json: Shift.where(shop_id: params[:shop_id])
  end

  def approve
    Shift.find(params[:id]).update!(approved: true)
  end
end
`,
  '.github/CODEOWNERS': `* @skelloapp/squad-alpha
/app/jobs/ @skelloapp/pastry
`,
}

const SVC_ALPHA = {
  'package.json': `{
  "name": "svc-alpha",
  "dependencies": {
    "@skelloapp/svc-beta-client": "1.0.0",
    "@skelloapp/svc-gamma-client": "1.0.0"
  }
}
`,
  'src/clients/beta.ts': `import { BetaClient } from '@skelloapp/svc-beta-client'

export const beta = new BetaClient()
`,
  'src/stream/publish.ts': `import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis'

export const publish = (data: Uint8Array) =>
  new KinesisClient({}).send(new PutRecordCommand({ StreamName: 'alpha-bus', PartitionKey: 'alpha', Data: data }))
`,
  'serverless.ts': `export default {
  service: 'svc-alpha',
  functions: {
    listItems: {
      handler: 'src/handlers/list-items.handler',
      events: [
        {
          httpApi: {
            method: 'GET',
            path: '/alpha/items',
          },
        },
      ],
    },
    processJobs: {
      handler: 'src/handlers/process-jobs.handler',
      events: [{ sqs: { arn: { 'Fn::GetAtt': ['AlphaJobsQueue', 'Arn'] } } }],
    },
    onShiftChange: {
      handler: 'src/handlers/on-shift-change.handler',
      events: [
        {
          stream: {
            arn: 'arn:aws:kinesis:eu-west-3:000000000000:stream/alpha-bus',
            type: 'kinesis',
            filterPatterns: [{ partitionKey: [{ prefix: 'public.shifts.' }] }],
          },
        },
      ],
    },
  },
  resources: {
    Resources: {
      AlphaJobsQueue: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: 'alphaJobs',
          RedrivePolicy: {
            deadLetterTargetArn: 'arn:aws:sqs:eu-west-3:000000000000:alphaJobsDlq',
            maxReceiveCount: 3,
          },
        },
      },
      AlphaJobsDlq: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: 'alphaJobsDlq',
        },
      },
    },
  },
}
`,
}

const SVC_BETA = {
  'serverless.ts': `export default {
  service: 'svc-beta',
  functions: {
    createJob: {
      handler: 'src/handlers/create-job.handler',
      events: [
        {
          httpApi: {
            method: 'POST',
            path: '/beta/jobs',
          },
        },
      ],
    },
    purgeJobs: {
      handler: 'src/handlers/purge-jobs.handler',
      events: [{ schedule: 'rate(1 day)' }],
    },
  },
}
`,
}

const SVC_ALPHA_TF = {
  'dms.tf': `resource "aws_kinesis_stream" "bus" {
  name = "alpha-bus"
}

resource "aws_dms_endpoint" "skelloapp_aurora" {
  endpoint_id   = "skelloapp-aurora"
  endpoint_type = "source"
  engine_name   = "aurora-postgresql"
}

resource "aws_dms_endpoint" "kinesis_target" {
  endpoint_id   = "alpha-kinesis"
  endpoint_type = "target"
  engine_name   = "kinesis"
  stream_arn    = aws_kinesis_stream.bus.arn
}

resource "aws_dms_replication_task" "shifts_cdc" {
  replication_task_id = "alpha-shifts-cdc"
  migration_type      = "cdc"
  source_endpoint_arn = aws_dms_endpoint.skelloapp_aurora.endpoint_arn
  target_endpoint_arn = aws_dms_endpoint.kinesis_target.endpoint_arn
  table_mappings      = file("\${path.module}/configs/tables.json")
}
`,
  'configs/tables.json': `{
  "rules": [
    {
      "rule-type": "selection",
      "rule-action": "include",
      "object-locator": { "schema-name": "public", "table-name": "shifts" }
    }
  ]
}
`,
}

const REPOS: Array<{ name: string; branch: string; files: Record<string, string> }> = [
  { name: 'skello-app', branch: 'master', files: SKELLO_APP },
  { name: 'svc-alpha', branch: 'master', files: SVC_ALPHA },
  { name: 'svc-beta', branch: 'master', files: SVC_BETA },
  { name: 'svc-alpha-tf', branch: 'main', files: SVC_ALPHA_TF },
]

const FIXED_DATE = '2026-11-01T12:00:00Z'
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Golden Fixture',
  GIT_AUTHOR_EMAIL: 'golden@example.test',
  GIT_AUTHOR_DATE: FIXED_DATE,
  GIT_COMMITTER_NAME: 'Golden Fixture',
  GIT_COMMITTER_EMAIL: 'golden@example.test',
  GIT_COMMITTER_DATE: FIXED_DATE,
}

const git = (cwd: string, args: string[]) => {
  execFileSync('git', args, { cwd, env: GIT_ENV, stdio: 'ignore' })
}

export function buildGoldenWorkspace(root: string): void {
  for (const repo of REPOS) {
    const dir = join(root, repo.name)
    for (const [file, content] of Object.entries(repo.files)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), content)
    }
    git(dir, ['init', '--quiet', '--initial-branch', repo.branch])
    git(dir, ['add', '.'])
    git(dir, ['commit', '--quiet', '--no-gpg-sign', '--message', `${repo.name} fixture`])
  }
}
