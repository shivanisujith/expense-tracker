import { formatDate } from '../dates.js'
import { formatRupees } from '../money.js'

// status: 'loading' | 'loaded' | 'error' | 'unreachable'
function ExpenseList({ expenses, status, onRetry }) {
  return (
    <section className="card">
      <h2>Expenses</h2>
      <ListBody expenses={expenses} status={status} onRetry={onRetry} />
    </section>
  )
}

function ListBody({ expenses, status, onRetry }) {
  if (status === 'error') {
    return (
      <div className="section-error" role="alert">
        <p>Couldn't load your expenses. Please try again.</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  // Nothing loaded yet: show loading, or nothing extra if the banner is up.
  if (expenses === null) {
    return status === 'loading' ? <p className="muted">Loading expenses...</p> : null
  }
  if (expenses.length === 0) {
    return <p className="muted">No expenses yet. Add your first one above.</p>
  }
  return (
    <ul className="expense-list">
      {expenses.map((expense) => (
        <li key={expense.id} className="expense-item">
          <div className="expense-main">
            <span className="expense-amount">{formatRupees(expense.amount_paise)}</span>
            <span className="expense-category">{expense.category}</span>
          </div>
          <div className="expense-details">
            <span>{formatDate(expense.date)}</span>
            {expense.note && <span className="expense-note">{expense.note}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ExpenseList
