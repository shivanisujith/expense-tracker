import { expect, test } from 'vitest'
import { currentMonthInIst, earliestMonth, monthOptions, shiftMonth } from './months.js'

test('the current month is worked out in IST, not the computer time zone', () => {
  // 31 Oct 2026, 20:00 UTC is already 1 Nov 2026, 01:30 in India.
  expect(currentMonthInIst(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11')
  expect(currentMonthInIst(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10')
})

test('shiftMonth moves one month back or forward, across years', () => {
  expect(shiftMonth('2026-10', -1)).toBe('2026-09')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  expect(shiftMonth('2026-09', 1)).toBe('2026-10')
})

test('the earliest month is the last in the newest-first list, or null', () => {
  expect(earliestMonth(['2026-10', '2026-09', '2026-07'])).toBe('2026-07')
  expect(earliestMonth([])).toBeNull()
  expect(earliestMonth(null)).toBeNull()
})

test('month options: months with expenses, newest first', () => {
  expect(monthOptions(['2026-10', '2026-09'], '2026-10', '2026-10')).toEqual(['2026-10', '2026-09'])
})

test('month options always include the current month, in date order', () => {
  expect(monthOptions(['2026-09', '2026-07'], '2026-10', '2026-10')).toEqual(['2026-10', '2026-09', '2026-07'])
  expect(monthOptions([], '2026-10', '2026-10')).toEqual(['2026-10'])
  expect(monthOptions(null, '2026-10', '2026-10')).toEqual(['2026-10'])
})

test('month options keep the chosen month after its last expense is gone', () => {
  expect(monthOptions(['2026-10', '2026-07'], '2026-10', '2026-09')).toEqual(['2026-10', '2026-09', '2026-07'])
})

test('"All months" as the choice adds no extra month', () => {
  expect(monthOptions(['2026-10', '2026-09'], '2026-10', 'all')).toEqual(['2026-10', '2026-09'])
})
