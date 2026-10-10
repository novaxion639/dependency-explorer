import { describe, it, expect } from 'vitest'
import { blockEnd, classify, constantPath, declarations, methodSpans, resolveConstant } from './ruby-source'

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

describe('blockEnd', () => {
  it('returns the index of the line closing the block opened at start', () => {
    const lines = ['def a', '  if x', '    y', '  end', 'end', 'z']
    expect(blockEnd(lines, 0)).toBe(4)
    expect(blockEnd(lines, 1)).toBe(3)
  })
  it('falls back to the last line when the block never closes', () => {
    expect(blockEnd(['def a', '  x'], 0)).toBe(1)
  })
})

describe('methodSpans block forms', () => {
  it('masks a single-quoted heredoc whose body holds end if', () => {
    const source = [
      'class Shift',
      '  def upsert!(x)',
      "    sql = <<~'SQL'",
      '      UPDATE shifts SET a = 1',
      '      end if',
      '    SQL',
      '    connection.execute(sql)',
      '  end',
      '  def second',
      '    1',
      '  end',
      'end',
    ].join('\n')
    expect(methodSpans(source).map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['upsert!', 2, 7],
      ['second', 9, 3],
    ])
  })
  it('masks a double-quoted heredoc whose body holds an apostrophe and end', () => {
    const source = [
      'class Shift',
      '  def upsert!(x)',
      '    sql = <<~"SQL"',
      "      it's end",
      '    SQL',
      '    connection.execute(sql)',
      '  end',
      '  def second',
      '    1',
      '  end',
      'end',
    ].join('\n')
    expect(methodSpans(source).map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['upsert!', 2, 6],
      ['second', 8, 3],
    ])
  })
  it('counts the do of while, until and for loops once, against their end', () => {
    const source = [
      'class Queue',
      '  def drain',
      '    while queue.any? do',
      '      queue.pop',
      '    end',
      '    until done do',
      '      step',
      '    end',
      '    for x in xs do',
      '      p x',
      '    end',
      '  end',
      '  def after',
      '    2',
      '  end',
      'end',
    ].join('\n')
    expect(methodSpans(source).map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['drain', 2, 11],
      ['after', 13, 3],
    ])
  })
  it('counts a block opened and closed on one line', () => {
    const source = [
      'class Shift',
      '  def each_one',
      '    items.each do |x| p x end',
      '    done',
      '  end',
      '  def after',
      '    2',
      '  end',
      'end',
    ].join('\n')
    expect(methodSpans(source).map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['each_one', 2, 4],
      ['after', 6, 3],
    ])
  })
  it('recognises visibility-prefixed defs', () => {
    const source = [
      'class Shift',
      '  private def a',
      '    1',
      '  end',
      '  protected def b',
      '    2',
      '  end',
      '  public def c',
      '    3',
      '  end',
      'end',
    ].join('\n')
    expect(methodSpans(source).map(s => [s.name, s.line, s.body.split('\n').length])).toEqual([
      ['a', 2, 3],
      ['b', 5, 3],
      ['c', 8, 3],
    ])
  })
})
