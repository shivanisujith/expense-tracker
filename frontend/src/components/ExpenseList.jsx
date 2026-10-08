import { useState } from 'react'
import { deleteExpense } from '../api.js'
import { formatDate } from '../dates.js'
import { formatRupees } from '../money.js'

// status: 'loading' | 'loaded' | 'error' | 'unreachable'
function ExpenseList({ expenses, status, editingId, onRetry, onEdit, onDeleted, onUnreachable }) {
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
        onDeleted(id)
      } else {
        setDeleteError("Couldn't delete. Please try again.")
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="card">
      <h2>Expenses</h2>
      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}
      <ListBody
        expenses={expenses}
        status={status}
        onRetry={onRetry}
        renderItem={(expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            isEditing={expense.id === editingId}
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

function ListBody({ expenses, status, onRetry, renderItem }) {
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
  return <ul className="expense-list">{expenses.map(renderItem)}</ul>
}

function ExpenseItem({
  expense,
  isEditing,
  confirming,
  deleting,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  return (
    <li className={isEditing ? 'expense-item editing' : 'expense-item'}>
      <div className="expense-row">
        <span className="expense-date">{formatDate(expense.date)}</span>
        <span className="expense-category">{expense.category}</span>
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

// `label` is read by screen readers and shown as a tooltip on hover.
function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ExpenseList
