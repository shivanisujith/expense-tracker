import { expect, test } from 'vitest'
import { formatDate, todayText } from './dates.js'

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
