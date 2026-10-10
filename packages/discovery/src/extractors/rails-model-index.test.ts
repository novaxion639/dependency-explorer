import { describe, it, expect } from 'vitest'
import { buildModelIndex, declarationsOf } from './rails-model-index'
import { fixtureModels, fixtureRead } from './__fixtures__/listeners'

const index = buildModelIndex(fixtureModels, fixtureRead)
const entry = (cls: string) => index.find(e => e.className === cls)

describe('buildModelIndex', () => {
  it('resolves callback bodies through included concerns', () => {
    expect(entry('Shift')?.methods.get('update_paid_leaves')).toMatchObject({ file: 'app/models/concerns/shifts/callbacks_concern.rb', line: 10 })
    expect(entry('Shift')?.modules).toEqual(['app/models/concerns/shifts/callbacks_concern.rb'])
  })
  it('keeps class methods under self.', () => {
    expect(entry('WeeklyOption')?.methods.has('self.upsert_employee_change!')).toBe(true)
  })
})

describe('declarationsOf', () => {
  it('attributes declarations inside a concern included block to the host, before the host’s own', () => {
    expect(declarationsOf(entry('Shop') ?? index[0], /^\s*(before|after)_\w+/).map(d => [d.file, d.line])).toEqual([
      ['app/models/concerns/token_authenticatable.rb', 4],
      ['app/models/shop.rb', 4],
      ['app/models/shop.rb', 5],
      ['app/models/shop.rb', 6],
    ])
  })
})
