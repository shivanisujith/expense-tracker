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
        <div>
          <div className="expense-main">
            <span className="expense-amount">{formatRupees(expense.amount_paise)}</span>
            <span className="expense-category">{expense.category}</span>
          </div>
          <div className="expense-details">
            <span>{formatDate(expense.date)}</span>
            {expense.note && <span className="expense-note">{expense.note}</span>}
          </div>
        </div>
        {!confirming && (
          <div className="item-buttons">
            <button type="button" className="secondary" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="secondary danger" onClick={onAskDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="confirm-delete" role="alert">
          <p>Delete this expense? This can't be undone.</p>
          <div className="item-buttons">
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
