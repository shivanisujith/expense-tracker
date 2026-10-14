import { useState } from 'react'
import { addExpense } from '../api.js'
import { todayText } from '../dates.js'
import { FIELD_LABELS, FORM_FIELD, checkForm, emptyForm } from '../expenseForm.js'
import SuccessMessage from './SuccessMessage.jsx'

/** The add expense form. It is always in add mode; editing uses EditExpenseModal. */
function ExpenseForm({ categories, success, onSaved, onUnreachable }) {
  const [values, setValues] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

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

  // Links an input to its message below the row, for screen readers.
  function errorProps(field) {
    const error = fieldErrors[field]
    return { 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${field}-error` : undefined }
  }

  function update(field) {
    return (event) => setValues({ ...values, [field]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const { errors, expense } = checkForm({ ...values, category: chosenCategory })
    setFieldErrors(errors)
    if (!expense) return

    setSaving(true)
    try {
      await addExpense(expense)
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
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <Field label="Amount (Rs)" id="amount">
            <input
              id="amount"
              inputMode="decimal"
              placeholder="12.50"
              value={values.amount}
              onChange={update('amount')}
              {...errorProps('amount')}
            />
          </Field>

          <Field label="Category" id="category">
            <select
              id="category"
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
          </Field>

          <Field label="Date" id="date">
            <input
              id="date"
              type="date"
              max={todayText()}
              value={values.date}
              onChange={update('date')}
              {...errorProps('date')}
            />
          </Field>

          <Field label="Note (optional)" id="note" wide>
            <input id="note" value={values.note} onChange={update('note')} {...errorProps('note')} />
          </Field>

          <div className="form-buttons">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Add expense'}
            </button>
          </div>
        </div>

        <FormMessages formError={formError} fieldErrors={fieldErrors} />
        <SuccessMessage success={success} className="below-row" />
      </form>
    </section>
  )
}

/** Field and form errors, shown together just below the form row. */
function FormMessages({ formError, fieldErrors }) {
  const fields = Object.keys(FIELD_LABELS).filter((field) => fieldErrors[field])
  if (!formError && fields.length === 0) return null
  return (
    <div className="form-messages" role="alert">
      {formError && <p className="form-error">{formError}</p>}
      {fields.map((field) => (
        <p key={field} className="field-error" id={`${field}-error`}>
          {FIELD_LABELS[field]}: {fieldErrors[field]}
        </p>
      ))}
    </div>
  )
}

function Field({ label, id, wide = false, children }) {
  return (
    <div className={wide ? 'field field-wide' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

export default ExpenseForm
