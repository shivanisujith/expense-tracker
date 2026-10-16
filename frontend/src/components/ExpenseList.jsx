import { useState } from 'react'
import { deleteExpense } from '../api.js'
import { formatDate, formatMonth } from '../dates.js'
import { formatRupees } from '../money.js'
import { ALL_MONTHS } from '../months.js'
import CategoryIconFor from './CategoryIconFor.jsx'
import { BinIcon, IconButton, PencilIcon } from './icons.jsx'
import SuccessMessage from './SuccessMessage.jsx'

// status: 'loading' | 'loaded' | 'error' | 'unreachable'
// month: the chosen month (YYYY-MM) or ALL_MONTHS; monthChoices: the months
// to offer, newest first. The backend filters the list for the chosen month.
function ExpenseList({
  expenses,
  status,
  month,
  monthChoices,
  onMonthChange,
  success,
  onRetry,
  onEdit,
  onDeleted,
  onReload,
  onUnreachable,
}) {
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete(id) {
    setDeleteError('')
    setDeletingId(id)
    try {
      await deleteExpense(id)
      setConfirmingId(null)
      onDeleted(id)
    } catch (error) {
      if (error.kind === 'unreachable') {
        onUnreachable()
      } else if (error.kind === 'not_found') {
        setConfirmingId(null)
        setDeleteError(error.message)
        onReload()
      } else {
        setDeleteError("Couldn't delete. Please try again.")
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="card expense-section">
      <div className="section-heading">
        <h2>Expenses</h2>
        <select
          className="month-select"
          aria-label="Show expenses from"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          <option value={ALL_MONTHS}>All months</option>
          {monthChoices.map((choice) => (
            <option key={choice} value={choice}>
              {formatMonth(choice)}
            </option>
          ))}
        </select>
      </div>
      <SuccessMessage success={success} className="top-of-list" />
      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}
      <ListBody
        expenses={expenses}
        status={status}
        month={month}
        onRetry={onRetry}
        renderItem={(expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            confirming={expense.id === confirmingId}
            deleting={expense.id === deletingId}
            onEdit={() => {
              setDeleteError('')
              onEdit(expense)
            }}
            onAskDelete={() => {
              setDeleteError('')
              setConfirmingId(expense.id)
            }}
            onCancelDelete={() => setConfirmingId(null)}
            onConfirmDelete={() => handleDelete(expense.id)}
          />
        )}
      />
    </section>
  )
}

function ListBody({ expenses, status, month, onRetry, renderItem }) {
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
    if (month !== ALL_MONTHS) return <p className="muted">{`No expenses in ${formatMonth(month)}.`}</p>
    return <p className="muted">No expenses yet. Add your first one above.</p>
  }
  // The headings and every row share one set of columns, so they line up.
  // Screen readers skip the headings; each row reads naturally on its own.
  return (
    <div className="expense-table">
      <div className="expense-headings" aria-hidden="true">
        <span>Date</span>
        <span>Category</span>
        <span>Note</span>
        <span className="amount-heading">Amount</span>
        <span />
      </div>
      <ul className="expense-list">{expenses.map(renderItem)}</ul>
    </div>
  )
}

function ExpenseItem({
  expense,
  confirming,
  deleting,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  return (
    <li className="expense-item">
      <div className="expense-row">
        <span className="expense-date">{formatDate(expense.date)}</span>
        <span className="expense-category">
          <CategoryIconFor categoryId={expense.category_id} />
          {expense.category}
        </span>
        <span className="expense-note">{expense.note}</span>
        <span className="expense-amount">{formatRupees(expense.amount_paise)}</span>
        <div className="item-buttons">
          <IconButton label="Edit expense" onClick={onEdit} disabled={confirming}>
            <PencilIcon />
          </IconButton>
          <IconButton label="Delete expense" onClick={onAskDelete} disabled={confirming}>
            <BinIcon />
          </IconButton>
        </div>
      </div>

      {confirming && (
        <div className="confirm-delete" role="alert">
          <p>Delete this expense? This can't be undone.</p>
          <div className="confirm-buttons">
            <button type="button" className="danger-solid" onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button type="button" className="secondary" onClick={onCancelDelete} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default ExpenseList
