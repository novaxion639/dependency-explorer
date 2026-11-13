import { describe, expect, it } from 'vitest'
import { easterOf, isWorkingDay, parisDay, workingDaysBetween } from './working-days'

describe('working days', () => {
  it('easterOf(2026) is 5 April, and other years follow the Gregorian computus', () => {
    expect([easterOf(2026), easterOf(2025), easterOf(2027), easterOf(2038)]).toEqual(['2026-04-05', '2025-04-20', '2027-03-28', '2038-04-25'])
  })

  it('the 2026 holidays include 6 April, 14 May and 25 May', () => {
    const holidays = ['01-01', '04-06', '05-01', '05-08', '05-14', '05-25', '07-14', '08-15', '11-01', '11-11', '12-25']
    expect(holidays.some((d) => isWorkingDay(`2026-${d}`))).toBe(false)
    expect(['2026-04-07', '2026-05-13', '2026-12-24'].every(isWorkingDay)).toBe(true)
  })

  it('a working day is Monday to Friday and no holiday', () => {
    expect(['2026-04-30', '2026-05-04'].every(isWorkingDay)).toBe(true)
    expect(['2026-05-01', '2026-05-02', '2026-05-03'].some(isWorkingDay)).toBe(false)
  })

  it('workingDaysBetween("2026-04-30", "2026-05-08") is 4', () => {
    expect(workingDaysBetween('2026-04-30', '2026-05-08')).toBe(4)
  })

  it('a release on a weekend after a holiday counts only working days', () => {
    expect(workingDaysBetween('2026-04-30', '2026-05-02')).toBe(0)
    expect(workingDaysBetween('2026-04-30', '2026-05-04')).toBe(1)
  })

  it('an early release is negative, and the same day is zero', () => {
    expect(workingDaysBetween('2026-05-04', '2026-04-30')).toBe(-1)
    expect(workingDaysBetween('2026-05-08', '2026-04-30')).toBe(-4)
    expect(workingDaysBetween('2026-05-04', '2026-05-04')).toBe(0)
  })

  it('the count crosses a year end', () => {
    expect(workingDaysBetween('2026-12-24', '2027-01-04')).toBe(5)
  })

  it('a Friday merge read on Monday is 1 working day', () => {
    expect(workingDaysBetween('2026-11-06', '2026-11-09')).toBe(1)
  })

  it('a merge on a Saturday or on a holiday counts the working days after it', () => {
    expect(workingDaysBetween('2026-11-07', '2026-11-09')).toBe(1)
    expect(workingDaysBetween('2026-05-01', '2026-05-04')).toBe(1)
  })

  it('11 November 2026 is not a working day', () => {
    expect(isWorkingDay('2026-11-11')).toBe(false)
  })

  it('Whit Monday 2026 is 25 May', () => {
    expect(isWorkingDay('2026-05-25')).toBe(false)
    expect(isWorkingDay('2026-05-26')).toBe(true)
  })

  it('parisDay turns 2026-11-11T23:30:00Z into 2026-11-12', () => {
    expect(parisDay('2026-11-11T23:30:00Z')).toBe('2026-11-12')
  })
})
