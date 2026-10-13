// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import ExpenseForm from './ExpenseForm.jsx'

afterEach(cleanup)

const STARTING = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'].map(
  (name, index) => ({ id: index + 1, name }),
)

function renamed(categories, id, name) {
  return categories.map((category) => (category.id === id ? { ...category, name } : category))
}

function renderForm(categories) {
  const props = { onSaved: () => {}, onUnreachable: () => {} }
  const view = render(<ExpenseForm categories={categories} {...props} />)
  return {
    select: () => screen.getByLabelText('Category'),
    update: (next) => view.rerender(<ExpenseForm categories={next} {...props} />),
  }
}

test('renaming the chosen category clears the choice, even after renaming it back', () => {
  const form = renderForm(STARTING)
  fireEvent.change(form.select(), { target: { value: 'Food' } })
  expect(form.select().value).toBe('Food')

  form.update(renamed(STARTING, 1, 'Groceries'))
  expect(form.select().value).toBe('')

  form.update(STARTING)
  expect(form.select().value).toBe('')
})

test('deleting the chosen category clears the choice, even if a new one gets the old name', () => {
  const form = renderForm(STARTING)
  fireEvent.change(form.select(), { target: { value: 'Other' } })

  const withoutOther = STARTING.filter((category) => category.name !== 'Other')
  form.update(withoutOther)
  expect(form.select().value).toBe('')

  form.update([...withoutOther, { id: 7, name: 'Other' }])
  expect(form.select().value).toBe('')
})

test('changes to other categories keep the choice', () => {
  const form = renderForm(STARTING)
  fireEvent.change(form.select(), { target: { value: 'Food' } })

  form.update(renamed(STARTING, 4, 'Utilities'))
  form.update([...renamed(STARTING, 4, 'Utilities'), { id: 7, name: 'Pets' }])

  expect(form.select().value).toBe('Food')
})
