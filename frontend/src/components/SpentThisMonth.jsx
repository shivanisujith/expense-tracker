import { formatMonth } from '../dates.js'
import { formatRupees } from '../money.js'
import { shiftMonth } from '../months.js'

/**
 * The highlight box at the top of the page (specs/frontend-spec.md, "Spent
 * this month box"). `data` holds the backend's total for `month`: the
 * summary for the current month, the month total for others. The page
 * never adds amounts up itself.
 */
function SpentThisMonth({ month, currentMonth, data, status, earliestMonth, onMonthChange }) {
  const isCurrent = month === currentMonth

  let amount
  if (data !== null) amount = formatRupees(data.total_spent_paise)
  else amount = status === 'loading' ? 'Loading...' : 'Rs –'

  return (
    <section className="card spent-box" aria-labelledby="spent-label">
      <div className="spent-top">
        <p className="spent-label" id="spent-label">
          {isCurrent ? 'Spent this month' : `Spent in ${formatMonth(month)}`}
        </p>
        <div className="month-arrows">
          <ArrowButton
            label="Previous month"
            disabled={earliestMonth === null || month <= earliestMonth}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            ‹
          </ArrowButton>
          <ArrowButton
            label="Next month"
            disabled={month >= currentMonth}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            ›
          </ArrowButton>
        </div>
      </div>
      <p className="spent-amount">{amount}</p>
      {/* Other months are named in the label, so only the current month gets this line. */}
      {isCurrent && data !== null && <p className="spent-month">{formatMonth(month)}</p>}
    </section>
  )
}

function ArrowButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className="secondary month-arrow"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

export default SpentThisMonth
