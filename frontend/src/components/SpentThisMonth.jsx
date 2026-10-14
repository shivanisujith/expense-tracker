import { formatMonth } from '../dates.js'
import { formatRupees } from '../money.js'

/**
 * The highlight box at the top of the page (specs/frontend-spec.md, "Spent
 * this month box"). The total comes from the backend's summary; the page
 * never adds amounts up itself.
 */
function SpentThisMonth({ summary, status }) {
  let amount
  if (summary !== null) amount = formatRupees(summary.total_spent_paise)
  else amount = status === 'loading' ? 'Loading...' : 'Rs –'

  return (
    <section className="card spent-box" aria-labelledby="spent-label">
      <p className="spent-label" id="spent-label">
        Spent this month
      </p>
      <p className="spent-amount">{amount}</p>
      {summary !== null && <p className="spent-month">{formatMonth(summary.month)}</p>}
    </section>
  )
}

export default SpentThisMonth
