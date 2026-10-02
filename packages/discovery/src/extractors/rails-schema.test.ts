import { describe, it, expect } from 'vitest'
import { parseSchemaTables, tableize, parseModelFile } from './rails-schema'

describe('parseSchemaTables', () => {
  it('lists create_table names', () => {
    const schema = 'ActiveRecord::Schema.define(version: 1) do\n  create_table "shifts", force: :cascade do |t|\n  end\n  create_table "planning_hours_data" do |t|\n  end\nend\n'
    expect(parseSchemaTables(schema)).toEqual(['planning_hours_data', 'shifts'])
  })
})

describe('tableize', () => {
  it('follows Rails inflection for the shapes the monolith uses', () => {
    expect(tableize('Shift')).toBe('shifts')
    expect(tableize('PlanningHoursData')).toBe('planning_hours_data')
    expect(tableize('Badging')).toBe('badgings')
    expect(tableize('WeeklyOption')).toBe('weekly_options')
    expect(tableize('Punch')).toBe('punches')
    expect(tableize('Company')).toBe('companies')
  })
})

describe('parseModelFile', () => {
  it('maps an ApplicationRecord class and its associations to tables', () => {
    const src = 'class Shift < ApplicationRecord\n  belongs_to :poste\n  belongs_to :user, class_name: \'Employee\'\n  has_many :tasks, dependent: :destroy\n  has_one :shift_replacement\n  # belongs_to :ghost\nend\n'
    expect(parseModelFile('app/models/shift.rb', src)).toEqual({
      className: 'Shift', file: 'app/models/shift.rb', table: 'shifts',
      associations: ['employees', 'postes', 'shift_replacements', 'tasks'],
    })
  })
  it('resolves plural association names through Rails singularize → tableize', () => {
    expect(parseModelFile('app/models/shift.rb', 'class Shift < ApplicationRecord\n  has_many :planning_hours_datas\n  has_many :companies\nend\n')?.associations).toEqual(['companies', 'planning_hours_data'])
  })
  it('honours self.table_name and ignores non-record classes', () => {
    expect(parseModelFile('app/models/x.rb', "class X < ApplicationRecord\n  self.table_name = 'legacy_x'\nend\n")?.table).toBe('legacy_x')
    expect(parseModelFile('app/models/error.rb', 'class InvalidThing < StandardError\nend\n')).toBeNull()
    expect(parseModelFile('app/models/application_record.rb', 'class ApplicationRecord < ActiveRecord::Base\n  self.abstract_class = true\nend\n')).toBeNull()
  })
})
