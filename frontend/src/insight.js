// The insight line in the Spent this month box (specs/frontend-spec.md,
// "Insight line"). The backend sends the numbers; this only puts them into
// words, so the page never adds up or subtracts amounts itself.
import { formatMonth } from './dates.js'
import { formatRupees } from './money.js'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function isReadable(insight) {
  return (
    insight !== null &&
    typeof insight === 'object' &&
    typeof insight.previous_month === 'string' &&
    MONTH_PATTERN.test(insight.previous_month) &&
    (insight.difference_paise === null || Number.isSafeInteger(insight.difference_paise)) &&
    Array.isArray(insight.biggest_categories) &&
    insight.biggest_categories.every((row) => typeof row?.category === 'string')
  )
}

/** "Food", "Food and Bills", "Food, Bills and Other". */
function joinNames(names) {
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function comparison(difference, previousMonth, shownMonth) {
  // The month before is named without its year when it's the same year.
  const sameYear = previousMonth.slice(0, 4) === shownMonth.slice(0, 4)
  const name = sameYear ? formatMonth(previousMonth).split(' ')[0] : formatMonth(previousMonth)
  if (difference === 0) return `Same as ${name}`
  const direction = difference < 0 ? 'less' : 'more'
  return `${formatRupees(Math.abs(difference))} ${direction} than ${name}`
}

function biggest(categories) {
  const names = categories.map((row) => row.category)
  return names.length === 1
    ? `${names[0]} is your biggest category`
    : `${joinNames(names)} are your biggest categories`
}

/**
 * Which trend icon starts the comparison: 'down' (less than the month
 * before), 'up' (more), 'same', or null when there is no comparison.
 */
export function insightTrend(insight) {
  if (!isReadable(insight) || insight.difference_paise === null) return null
  if (insight.difference_paise === 0) return 'same'
  return insight.difference_paise < 0 ? 'down' : 'up'
}

/**
 * The line for `insight` (from the summary or a month total) describing
 * `shownMonth`, or null when it can't be read, so the line is left out.
 */
export function insightText(insight, shownMonth) {
  if (!isReadable(insight)) return null
  const parts = []
  if (insight.difference_paise !== null) {
    parts.push(comparison(insight.difference_paise, insight.previous_month, shownMonth))
  }
  if (insight.biggest_categories.length > 0) parts.push(biggest(insight.biggest_categories))
  return parts.length > 0 ? parts.join(' · ') : `No expenses in ${formatMonth(shownMonth)}.`
}
