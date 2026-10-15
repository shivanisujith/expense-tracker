import { useEffect, useRef, useState } from 'react'
import { editExpense } from '../api.js'
import { todayText } from '../dates.js'
import { FORM_FIELD, checkForm, formFromExpense } from '../expenseForm.js'
import ModalField from './ModalField.jsx'

const UNREACHABLE_MESSAGE = "Can't reach the server. Check that the backend is running, then try again."

/**
 * The edit popup. Uses the browser's <dialog> element, which darkens the
 * page behind it, keeps focus inside, and starts on the first field.
 */
function EditExpenseModal({ expense, categories, onSaved, onClose, onNotFound, onUnreachable }) {
  const dialogRef = useRef(null)
  const [values, setValues] = useState(() => formFromExpense(expense))
  const [fieldErrors, setFieldErrors] = useState({})
  const [topMessage, setTopMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  // Escape: close like Cancel, except while saving.
  function handleCancelEvent(event) {
    event.preventDefault()
    if (!saving) onClose()
  }

  function update(field) {
    return (event) => setValues({ ...values, [field]: event.target.value })
  }

  function errorProps(field) {
    const error = fieldErrors[field]
    return {
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `edit-${field}-error` : undefined,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTopMessage('')
    const { errors, expense: changes } = checkForm(values)
    setFieldErrors(errors)
    if (!changes) return

    setSaving(true)
    try {
      await editExpense(expense.id, changes)
      onSaved()
    } catch (error) {
      if (error.kind === 'unreachable') {
        setTopMessage(UNREACHABLE_MESSAGE)
        onUnreachable()
      } else if (error.kind === 'not_found') {
        setNotFound(true)
        setTopMessage(error.message)
        onNotFound()
      } else if (error.kind === 'invalid' && FORM_FIELD[error.field]) {
        setFieldErrors({ [FORM_FIELD[error.field]]: error.message })
      } else {
        setTopMessage(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="edit-title"
      onCancel={handleCancelEvent}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 id="edit-title">Edit expense</h2>
        {topMessage && (
          <p className="form-error modal-message" role="alert">
            {topMessage}
          </p>
        )}

        <fieldset className="modal-fields" disabled={notFound}>
          <ModalField label="Amount (Rs)" id="edit-amount" error={fieldErrors.amount}>
            <input
              id="edit-amount"
              inputMode="decimal"
              value={values.amount}
              onChange={update('amount')}
              {...errorProps('amount')}
            />
          </ModalField>

          <ModalField label="Category" id="edit-category" error={fieldErrors.category}>
            <select
              id="edit-category"
              value={values.category}
              onChange={update('category')}
              {...errorProps('category')}
            >
              {categories.map((category) => (
                <option key={category.id}>{category.name}</option>
              ))}
            </select>
          </ModalField>

          <ModalField label="Date" id="edit-date" error={fieldErrors.date}>
            <input
              id="edit-date"
              type="date"
              max={todayText()}
              value={values.date}
              onChange={update('date')}
              {...errorProps('date')}
            />
          </ModalField>

          <ModalField label="Note (optional)" id="edit-note" error={fieldErrors.note}>
            <input
              id="edit-note"
              value={values.note}
              onChange={update('note')}
              {...errorProps('note')}
            />
          </ModalField>
        </fieldset>

        <div className="modal-buttons">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {notFound ? 'Close' : 'Cancel'}
          </button>
          {!notFound && (
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}

export default EditExpenseModal
