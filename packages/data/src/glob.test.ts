import { describe, it, expect } from 'vitest'
import { globToRegExp } from './glob'

describe('globToRegExp', () => {
  it('matches everything under a ** suffix', () => {
    const re = globToRegExp('app/models/**')
    expect(re.test('app/models/shift.rb')).toBe(true)
    expect(re.test('app/models/concerns/a.rb')).toBe(true)
    expect(re.test('app/modelsX/a.rb')).toBe(false)
  })

  it('keeps * inside one path segment', () => {
    const re = globToRegExp('app/models/weekly_option*.rb')
    expect(re.test('app/models/weekly_option_publication.rb')).toBe(true)
    expect(re.test('app/models/sub/weekly_option.rb')).toBe(false)
  })

  it('lets **/ match zero or more directories', () => {
    const re = globToRegExp('src/**/Planning/**')
    expect(re.test('src/Planning/index.tsx')).toBe(true)
    expect(re.test('src/screens/Planning/Shift/Form.tsx')).toBe(true)
  })

  it('treats regex metacharacters literally', () => {
    const re = globToRegExp('apps/base-app/src/routes/_authenticated/shops/$shopId/plannings/**')
    expect(re.test('apps/base-app/src/routes/_authenticated/shops/$shopId/plannings/months.tsx')).toBe(true)
    expect(globToRegExp('a.rb').test('aXrb')).toBe(false)
    expect(globToRegExp('a+b.ts').test('a+b.ts')).toBe(true)
  })

  it('matches a single character with ?', () => {
    expect(globToRegExp('v?/a.ts').test('v3/a.ts')).toBe(true)
    expect(globToRegExp('v?/a.ts').test('v3x/a.ts')).toBe(false)
  })

  it('matches a whole repo with **', () => {
    expect(globToRegExp('**').test('src/Manager/ClockInOutManager.ts')).toBe(true)
  })
})
