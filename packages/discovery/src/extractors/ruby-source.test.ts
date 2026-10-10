import { describe, it, expect } from 'vitest'
import { classify, constantPath, declarations, methodSpans, resolveConstant } from './ruby-source'

const SOURCE = [
  'class Shift < ApplicationRecord',
  '  after_commit :update_paid_leaves,',
  '               :manage_predicted_shift',
  '  def update_paid_leaves',
  '    return unless user && starts_at',
  '    UpdatePaidLeavesCounterJob.perform_later([user.id], starts_at.to_s)',
  '  end',
  '  def self.bulk!(ids)',
  '    ids.each do |id|',
  '      if id then touch end',
  '    end',
  '  end',
  '  class << self',
  '    def upsert!(x)',
  '      sql = <<~SQL',
  '        INSERT INTO shifts (a) VALUES (1) ON CONFLICT DO UPDATE SET a = 2 -- end if',
  '      SQL',
  '      connection.execute(sql)',
  '    end',
  '  end',
  'end',
].join('\n')

describe('methodSpans', () => {
  it('closes each method at its own end across modifiers, one-line ifs, do-blocks and heredocs', () => {
    const spans = methodSpans(SOURCE)
    expect(spans.map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['update_paid_leaves', 4, 4],
      ['self.bulk!', 8, 5],
      ['self.upsert!', 14, 6],
    ])
  })
  it('keeps heredoc text in raw and masks it in body', () => {
    const upsert = methodSpans(SOURCE).find(s => s.name === 'self.upsert!')
    expect(upsert?.raw).toContain('INSERT INTO shifts')
    expect(upsert?.body).not.toContain('INSERT INTO')
  })
})

describe('declarations', () => {
  it('joins the continuation lines of a matching declaration', () => {
    expect(declarations(SOURCE, /^\s*after_commit\b/)).toEqual([
      { text: '  after_commit :update_paid_leaves, :manage_predicted_shift', line: 2 },
    ])
  })
})

describe('constants', () => {
  it('maps a constant to its Zeitwerk path and resolves it under the first root holding it', () => {
    expect(constantPath('Shifts::ShiftDataUpdaterJob')).toBe('shifts/shift_data_updater_job.rb')
    const read = (p: string) => (p === 'app/jobs/shifts/shift_data_updater_job.rb' ? 'class X; end' : null)
    expect(resolveConstant('::Shifts::ShiftDataUpdaterJob', ['app/workers', 'app/jobs'], read)).toBe('app/jobs/shifts/shift_data_updater_job.rb')
    expect(resolveConstant('Missing', ['app/jobs'], read)).toBeNull()
  })
  it('classifies a plural snake-case word into its model constant', () => {
    expect(classify('shift_swaps')).toBe('ShiftSwap')
  })
})
