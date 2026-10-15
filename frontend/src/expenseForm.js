// Shared by the add and edit popups: the form's starting values and
// the frontend checks from specs/frontend-spec.md. The backend checks again.

import { NOTE_MAX_LENGTH } from './categories.js'
import { todayText } from './dates.js'
import { paiseToRupeesText, parseRupees } from './money.js'

// Backend field names -> form field names, for showing 422 errors.
export const FORM_FIELD = { amount_paise: 'amount', category: 'category', date: 'date', note: 'note' }

// Category starts empty, so the box shows "Choose a category".
export function emptyForm() {
  return { amount: '', category: '', date: todayText(), note: '' }
}

export function formFromExpense(expense) {
  return {
    amount: paiseToRupeesText(expense.amount_paise),
    category: expense.category,
    date: expense.date,
    note: expense.note,
  }
}

/**
 * Runs the frontend checks. Returns { errors } keyed by form field, plus
 * { expense } ready to send to the backend when there are no errors.
 */
export function checkForm(values, today = todayText()) {
  const errors = {}
  const amount = parseRupees(values.amount)
  if (amount.error) errors.amount = amount.error
  if (values.category === '') errors.category = 'Please choose a category.'
  if (values.date === '') errors.date = 'Please choose a date.'
  else if (values.date > today) errors.date = 'Date cannot be in the future.'
  if (values.note.trim().length > NOTE_MAX_LENGTH) {
    errors.note = 'Note must be 100 characters or fewer.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return {
    errors,
    expense: {
      amount_paise: amount.paise,
      category: values.category,
      date: values.date,
      note: values.note,
    },
  }
}
