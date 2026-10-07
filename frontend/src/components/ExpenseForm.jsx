import { useState } from 'react'
import { addExpense } from '../api.js'
import { CATEGORIES, NOTE_MAX_LENGTH } from '../categories.js'
import { todayText } from '../dates.js'
import { parseRupees } from '../money.js'

// Backend field names -> form field names, for showing 422 errors.
const FORM_FIELD = { amount_paise: 'amount', category: 'category', date: 'date', note: 'note' }

function emptyForm() {
  return { amount: '', category: 'Food', date: todayText(), note: '' }
}

/** Frontend checks from specs/frontend-spec.md. The backend checks again. */
function checkForm(values) {
  const errors = {}
  const amount = parseRupees(values.amount)
  if (amount.error) errors.amount = amount.error
  if (values.date === '') errors.date = 'Please choose a date.'
  else if (values.date > todayText()) errors.date = 'Date cannot be in the future.'
  if (values.note.trim().length > NOTE_MAX_LENGTH) {
    errors.note = 'Note must be 100 characters or fewer.'
  }
  return { errors, amountPaise: amount.paise }
}

function ExpenseForm({ onSaved, onUnreachable }) {
  const [values, setValues] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field) {
    return (event) => setValues({ ...values, [field]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const { errors, amountPaise } = checkForm(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      await addExpense({
        amount_paise: amountPaise,
        category: values.category,
        date: values.date,
        note: values.note,
      })
      setValues(emptyForm())
      onSaved()
    } catch (error) {
      if (error.kind === 'unreachable') {
        onUnreachable()
      } else if (error.kind === 'invalid' && FORM_FIELD[error.field]) {
        setFieldErrors({ [FORM_FIELD[error.field]]: error.message })
      } else {
        setFormError(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h2>Add expense</h2>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Amount (Rs)" id="amount" error={fieldErrors.amount}>
          <input
            id="amount"
            inputMode="decimal"
            placeholder="12.50"
            value={values.amount}
            onChange={update('amount')}
            aria-invalid={Boolean(fieldErrors.amount)}
            aria-describedby={fieldErrors.amount ? 'amount-error' : undefined}
          />
        </Field>

        <Field label="Category" id="category" error={fieldErrors.category}>
          <select id="category" value={values.category} onChange={update('category')}>
            {CATEGORIES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>

        <Field label="Date" id="date" error={fieldErrors.date}>
          <input
            id="date"
            type="date"
            max={todayText()}
            value={values.date}
            onChange={update('date')}
            aria-invalid={Boolean(fieldErrors.date)}
            aria-describedby={fieldErrors.date ? 'date-error' : undefined}
          />
        </Field>

        <Field label="Note (optional)" id="note" error={fieldErrors.note}>
          <input
            id="note"
            value={values.note}
            onChange={update('note')}
            aria-invalid={Boolean(fieldErrors.note)}
            aria-describedby={fieldErrors.note ? 'note-error' : undefined}
          />
        </Field>

        <div className="form-buttons">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add expense'}
          </button>
        </div>
      </form>
    </section>
  )
}

function Field({ label, id, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export default ExpenseForm
