// Months are text in YYYY-MM form, like the API's (e.g. "2026-09"), so
// comparing two of them as text also compares them by date.
import { todayInIst } from './dates.js'

/** The Expenses box's choice for "every month". */
export const ALL_MONTHS = 'all'

/** The current month in IST, from the computer's clock. */
export function currentMonthInIst(now = new Date()) {
  return todayInIst(now).slice(0, 7)
}

/** The month `by` months after `month` (negative goes back). */
export function shiftMonth(month, by) {
  const [year, monthNumber] = month.split('-').map(Number)
  const index = year * 12 + (monthNumber - 1) + by
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** The month of the earliest expense, from the newest-first months list. */
export function earliestMonth(months) {
  return months && months.length > 0 ? months[months.length - 1] : null
}

/**
 * The months offered in the Expenses box, newest first: every month with an
 * expense, plus the current month and the chosen one even if they have none.
 */
export function monthOptions(months, currentMonth, chosen) {
  const options = new Set([...(months ?? []), currentMonth])
  if (chosen !== ALL_MONTHS) options.add(chosen)
  return [...options].sort().reverse()
}
