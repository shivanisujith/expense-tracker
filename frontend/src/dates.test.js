import { expect, test } from 'vitest'
import { formatDate, formatFullDate, formatMonth, todayText } from './dates.js'

test.each([
  ['2026-10-07', '7 Oct 2026'],
  ['2026-01-31', '31 Jan 2026'],
  ['2025-12-01', '1 Dec 2025'],
])('"%s" is shown as "%s"', (text, shown) => {
  expect(formatDate(text)).toBe(shown)
})

test('today is written as YYYY-MM-DD with leading zeros', () => {
  expect(todayText(new Date(2026, 0, 5))).toBe('2026-01-05')
})

test.each([
  ['2026-10', 'October 2026'],
  ['2027-01', 'January 2027'],
])('month "%s" is shown as "%s"', (text, shown) => {
  expect(formatMonth(text)).toBe(shown)
})

test.each([
  [new Date(2026, 9, 8), 'Thursday, 8 October 2026'],
  [new Date(2026, 0, 1), 'Thursday, 1 January 2026'],
  [new Date(2026, 11, 27), 'Sunday, 27 December 2026'],
])('%s is shown in full as "%s"', (date, shown) => {
  expect(formatFullDate(date)).toBe(shown)
})
