import { expect, test } from 'vitest'
import { dayLabel, formatFullDate, formatMonth, todayInIst, todayText } from './dates.js'

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

// --- The day on expense rows (specs/frontend-spec.md, "Expense list") ---

test('today in IST, not in the computer\'s own time zone', () => {
  // 15 Oct 2026, 20:00 UTC is already 16 Oct, 01:30 in India.
  expect(todayInIst(new Date('2026-10-15T20:00:00Z'))).toBe('2026-10-16')
  expect(todayInIst(new Date('2026-10-15T18:00:00Z'))).toBe('2026-10-15')
})

test.each([
  ['2026-10-16', 'Today'],
  ['2026-10-15', 'Yesterday'],
  ['2026-10-14', '14 Oct'],
  ['2026-01-03', '3 Jan'],
  ['2025-10-16', '16 Oct 2025'],
  ['2025-12-31', '31 Dec 2025'],
])('on 16 Oct 2026, "%s" is shown as "%s"', (date, shown) => {
  expect(dayLabel(date, '2026-10-16')).toBe(shown)
})

test('"Yesterday" works across the start of a month and a year', () => {
  expect(dayLabel('2026-09-30', '2026-10-01')).toBe('Yesterday')
  expect(dayLabel('2025-12-31', '2026-01-01')).toBe('Yesterday')
  expect(dayLabel('2024-02-29', '2024-03-01')).toBe('Yesterday')
})
