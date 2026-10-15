import { useEffect, useRef, useState } from 'react'
import { addExpense } from '../api.js'
import { todayText } from '../dates.js'
import { FORM_FIELD, checkForm, emptyForm } from '../expenseForm.js'
import ModalField from './ModalField.jsx'

const UNREACHABLE_MESSAGE = "Can't reach the server. Check that the backend is running, then try again."

/**
 * The Add expense popup (specs/frontend-spec.md, section 2). Same <dialog>
 * pattern as EditExpenseModal. It starts fresh each time it opens, and
 * closing it discards anything typed.
 */
function AddExpenseModal({ categories, onSaved, onClose, onUnreachable }) {
  const dialogRef = useRef(null)
  const [values, setValues] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [topMessage, setTopMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  const categoryNames = categories.map((category) => category.name)

  // If the chosen category is renamed or deleted, the choice is cleared (not
  // just hidden), so a later category with the old name is never chosen by
  // accident. React's "adjust state when a prop changes" pattern: compare
  // with the list seen last time, during render.
  const namesKey = categoryNames.join('\n')
  const [seenNamesKey, setSeenNamesKey] = useState(namesKey)
  if (namesKey !== seenNamesKey) {
    setSeenNamesKey(namesKey)
    if (values.category !== '' && !categoryNames.includes(values.category)) {
      setValues({ ...values, category: '' })
    }
  }
  const chosenCategory = categoryNames.includes(values.category) ? values.category : ''

  // Escape: close like Cancel, except while saving.
  function handleCancelEvent(event) {
    event.preventDefault()
    if (!saving) onClose()
  }

  function update(field) {
    return (event) => setValues({ ...values, [field]: event.target.value })
  }

  // Links an input to its message under it, for screen readers.
  function errorProps(field) {
    const error = fieldErrors[field]
    return {
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `add-${field}-error` : undefined,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTopMessage('')
    const { errors, expense } = checkForm({ ...values, category: chosenCategory })
    setFieldErrors(errors)
    if (!expense) return

    setSaving(true)
    try {
      await addExpense(expense)
      onSaved()
    } catch (error) {
      if (error.kind === 'unreachable') {
        setTopMessage(UNREACHABLE_MESSAGE)
        onUnreachable()
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
      aria-labelledby="add-title"
      onCancel={handleCancelEvent}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 id="add-title">Add expense</h2>
        {topMessage && (
          <p className="form-error modal-message" role="alert">
            {topMessage}
          </p>
        )}

        <div className="modal-fields">
          <ModalField label="Amount (Rs)" id="add-amount" error={fieldErrors.amount}>
            <input
              id="add-amount"
              inputMode="decimal"
              placeholder="12.50"
              value={values.amount}
              onChange={update('amount')}
              {...errorProps('amount')}
            />
          </ModalField>

          <ModalField label="Category" id="add-category" error={fieldErrors.category}>
            <select
              id="add-category"
              className={chosenCategory === '' ? 'placeholder' : undefined}
              value={chosenCategory}
              onChange={update('category')}
              {...errorProps('category')}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categoryNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </ModalField>

          <ModalField label="Date" id="add-date" error={fieldErrors.date}>
            <input
              id="add-date"
              type="date"
              max={todayText()}
              value={values.date}
              onChange={update('date')}
              {...errorProps('date')}
            />
          </ModalField>

          <ModalField label="Note (optional)" id="add-note" error={fieldErrors.note}>
            <input id="add-note" value={values.note} onChange={update('note')} {...errorProps('note')} />
          </ModalField>
        </div>

        <div className="modal-buttons">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add expense'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default AddExpenseModal
