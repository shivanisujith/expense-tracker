import { describe, expect, test } from 'vitest'
import { checkForm, emptyForm, formFromExpense } from './expenseForm.js'

const TODAY = '2026-10-08'

function form(changes = {}) {
  return { amount: '12.50', category: 'Food', date: TODAY, note: 'Lunch', ...changes }
}

describe('checkForm', () => {
  test('valid values become an expense ready to send', () => {
    expect(checkForm(form(), TODAY)).toEqual({
      errors: {},
      expense: { amount_paise: 1250, category: 'Food', date: TODAY, note: 'Lunch' },
    })
  })

  test('an empty amount is refused', () => {
    const result = checkForm(form({ amount: '' }), TODAY)
    expect(result.errors).toEqual({ amount: 'Please enter an amount.' })
    expect(result.expense).toBeUndefined()
  })

  test('no category chosen is refused', () => {
    const result = checkForm(form({ category: '' }), TODAY)
    expect(result.errors).toEqual({ category: 'Please choose a category.' })
    expect(result.expense).toBeUndefined()
  })

  test('an empty date is refused', () => {
    expect(checkForm(form({ date: '' }), TODAY).errors).toEqual({ date: 'Please choose a date.' })
  })

  test('tomorrow is refused, today and the past are accepted', () => {
    expect(checkForm(form({ date: '2026-10-09' }), TODAY).errors).toEqual({
      date: 'Date cannot be in the future.',
    })
    expect(checkForm(form({ date: TODAY }), TODAY).errors).toEqual({})
    expect(checkForm(form({ date: '2025-01-01' }), TODAY).errors).toEqual({})
  })

  test('a note over 100 characters is refused', () => {
    expect(checkForm(form({ note: 'x'.repeat(101) }), TODAY).errors).toEqual({
      note: 'Note must be 100 characters or fewer.',
    })
  })

  test('spaces around a 100-character note do not count', () => {
    expect(checkForm(form({ note: `  ${'x'.repeat(100)}  ` }), TODAY).errors).toEqual({})
  })

  test('every failing field is reported at once', () => {
    const result = checkForm(
      form({ amount: '-5', category: '', date: '', note: 'x'.repeat(101) }),
      TODAY,
    )
    expect(Object.keys(result.errors)).toEqual(['amount', 'category', 'date', 'note'])
  })
})

describe('emptyForm', () => {
  test('starts with no category chosen', () => {
    expect(emptyForm().category).toBe('')
  })

  test('fails the category check until one is chosen', () => {
    const values = { ...emptyForm(), amount: '10' }
    expect(checkForm(values).errors).toEqual({ category: 'Please choose a category.' })
  })
})

describe('formFromExpense', () => {
  test('fills the form with an expense, ready to check again', () => {
    const expense = { id: 7, amount_paise: 1250, category: 'Bills', date: '2026-10-01', note: '' }

    const values = formFromExpense(expense)

    expect(values).toEqual({ amount: '12.50', category: 'Bills', date: '2026-10-01', note: '' })
    expect(checkForm(values, TODAY).expense).toEqual({
      amount_paise: 1250,
      category: 'Bills',
      date: '2026-10-01',
      note: '',
    })
  })
})
