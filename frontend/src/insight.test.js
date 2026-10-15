// Turning the backend's insight into words (specs/frontend-spec.md,
// "Insight line"). The page only formats; it never adds up amounts.
import { expect, test } from 'vitest'
import { insightText, insightTrend } from './insight.js'

const FOOD = { category_id: 1, category: 'Food' }
const BILLS = { category_id: 4, category: 'Bills' }
const OTHER = { category_id: 6, category: 'Other' }

function insight(difference_paise, biggest_categories = [FOOD], previous_month = '2026-09') {
  return { previous_month, difference_paise, biggest_categories }
}

test('less than the month before, with the biggest category', () => {
  expect(insightText(insight(-62000), '2026-10')).toBe(
    'Rs 620.00 less than September · Food is your biggest category',
  )
})

test('more than the month before, with Indian digit grouping and paise', () => {
  expect(insightText(insight(12345650), '2026-10')).toBe(
    'Rs 1,23,456.50 more than September · Food is your biggest category',
  )
})

test('exactly the same as the month before', () => {
  expect(insightText(insight(0), '2026-10')).toBe('Same as September · Food is your biggest category')
})

test('the month before is named with its year when the year is different', () => {
  expect(insightText(insight(-500, [BILLS], '2025-12'), '2026-01')).toBe(
    'Rs 5.00 less than December 2025 · Bills is your biggest category',
  )
})

test('two tied categories are both named', () => {
  expect(insightText(insight(100, [FOOD, BILLS]), '2026-10')).toBe(
    'Rs 1.00 more than September · Food and Bills are your biggest categories',
  )
})

test('three or more tied categories are all named, in the order given', () => {
  expect(insightText(insight(null, [FOOD, BILLS, OTHER]), '2026-10')).toBe(
    'Food, Bills and Other are your biggest categories',
  )
})

test('no month before to compare with: only the biggest category', () => {
  expect(insightText(insight(null, [FOOD]), '2026-10')).toBe('Food is your biggest category')
})

test('nothing spent yet this month: only the comparison', () => {
  expect(insightText(insight(-921000, []), '2026-10')).toBe('Rs 9,210.00 less than September')
})

test('nothing spent in either month: says so for the shown month', () => {
  expect(insightText(insight(null, []), '2026-10')).toBe('No expenses in October 2026.')
  expect(insightText(insight(null, [], '2026-08'), '2026-09')).toBe('No expenses in September 2026.')
})

test.each([
  ['missing', undefined],
  ['null', null],
  ['not an object', 'Food'],
  ['no biggest list', { previous_month: '2026-09', difference_paise: 0 }],
  ['a decimal difference', insight(12.5)],
  ['a text difference', insight('-62000')],
  ['a bad month', insight(0, [FOOD], 'September')],
  ['a category without a name', insight(0, [{ category_id: 1 }])],
])('an insight that can\'t be read (%s) gives no line, never "NaN"', (_, value) => {
  expect(insightText(value, '2026-10')).toBeNull()
})

// --- The trend icon's direction ---

test.each([
  ['less', -62000, 'down'],
  ['more', 100, 'up'],
  ['the same', 0, 'same'],
])('%s than the month before gives its trend', (_, difference, trend) => {
  expect(insightTrend(insight(difference))).toBe(trend)
})

test('no comparison, or an insight that can\'t be read, gives no trend', () => {
  expect(insightTrend(insight(null))).toBeNull()
  expect(insightTrend(insight(null, []))).toBeNull()
  expect(insightTrend(undefined)).toBeNull()
  expect(insightTrend(insight('-5'))).toBeNull()
})
