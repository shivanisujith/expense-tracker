// @vitest-environment jsdom
// The Add expense popup (specs/frontend-spec.md, section 2), with a fake
// addExpense in place of the real backend.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import '../dialogStub.js'
import { ApiError, addExpense } from '../api.js'
import AddExpenseModal from './AddExpenseModal.jsx'

vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  addExpense: vi.fn(),
}))

const STARTING = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'].map(
  (name, index) => ({ id: index + 1, name }),
)

let props

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T06:00:00Z'))
  props = { onSaved: vi.fn(), onClose: vi.fn(), onUnreachable: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function renderPopup(categories = STARTING) {
  const view = render(<AddExpenseModal categories={categories} {...props} />)
  return {
    update: (next) => view.rerender(<AddExpenseModal categories={next} {...props} />),
  }
}

const field = (label) => screen.getByLabelText(label)
const dialog = () => screen.getByRole('dialog', { name: 'Add expense' })
const addButton = () => screen.getByRole('button', { name: 'Add expense' })
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' })

function fillValid() {
  fireEvent.change(field('Amount (Rs)'), { target: { value: '12.50' } })
  fireEvent.change(field('Category'), { target: { value: 'Food' } })
  fireEvent.change(field('Note (optional)'), { target: { value: 'Lunch' } })
}

// --- Look and defaults ---

test('opens as a popup titled "Add expense", with every field at its default', () => {
  renderPopup()

  expect(dialog().open).toBe(true)
  expect(field('Amount (Rs)').value).toBe('')
  expect(field('Category').value).toBe('')
  expect(field('Category').className).toBe('placeholder')
  expect(field('Date').value).toBe('2026-10-15')
  expect(field('Note (optional)').value).toBe('')
  expect(cancelButton()).toBeTruthy()
})

test('the category list is the current categories, after "Choose a category"', () => {
  renderPopup()
  const options = [...field('Category').options].map((option) => option.textContent)
  expect(options).toEqual(['Choose a category', ...STARTING.map((category) => category.name)])
})

// --- Checks: same messages, now under each field ---

test('each check message shows under its own field, and nothing is sent', () => {
  renderPopup()
  fireEvent.change(field('Date'), { target: { value: '' } })
  fireEvent.click(addButton())

  expect(field('Amount (Rs)').getAttribute('aria-describedby')).toBe('add-amount-error')
  expect(document.getElementById('add-amount-error').textContent).toBe('Please enter an amount.')
  expect(document.getElementById('add-category-error').textContent).toBe('Please choose a category.')
  expect(document.getElementById('add-date-error').textContent).toBe('Please choose a date.')
  // No "Amount:" label in front any more: the message sits under its field.
  expect(screen.queryByText(/^Amount: /)).toBeNull()
  expect(addExpense).not.toHaveBeenCalled()
})

test.each([
  ['abc', 'Amount must be a number, like 12.50.'],
  ['0', 'Amount must be greater than 0.'],
  ['1.234', 'Amount can have at most 2 decimal places.'],
  ['100000000.01', 'Amount is too large.'],
])('amount "%s" shows "%s"', (amount, message) => {
  renderPopup()
  fillValid()
  fireEvent.change(field('Amount (Rs)'), { target: { value: amount } })
  fireEvent.click(addButton())

  expect(document.getElementById('add-amount-error').textContent).toBe(message)
  expect(addExpense).not.toHaveBeenCalled()
})

// --- Saving ---

test('a valid expense is sent in paise, and the popup reports success', async () => {
  addExpense.mockResolvedValue({ id: 9 })
  renderPopup()
  fillValid()

  await act(async () => fireEvent.click(addButton()))

  expect(addExpense).toHaveBeenCalledWith({
    amount_paise: 1250,
    category: 'Food',
    date: '2026-10-15',
    note: 'Lunch',
  })
  expect(props.onSaved).toHaveBeenCalledTimes(1)
})

test('while saving: "Saving...", both buttons disabled, and Escape does nothing', async () => {
  let finish
  addExpense.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  renderPopup()
  fillValid()
  fireEvent.click(addButton())

  expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true)
  expect(cancelButton().disabled).toBe(true)
  fireEvent(dialog(), new Event('cancel', { cancelable: true }))
  expect(props.onClose).not.toHaveBeenCalled()

  await act(async () => finish({ id: 9 }))
})

test('refused by the backend: the message shows under that field, typed values kept', async () => {
  addExpense.mockRejectedValue(new ApiError('invalid', 'Date cannot be in the future.', 'date'))
  renderPopup()
  fillValid()

  await act(async () => fireEvent.click(addButton()))

  expect(document.getElementById('add-date-error').textContent).toBe('Date cannot be in the future.')
  expect(field('Amount (Rs)').value).toBe('12.50')
  expect(props.onSaved).not.toHaveBeenCalled()
})

test('a server error shows at the top of the popup, typed values kept', async () => {
  addExpense.mockRejectedValue(
    new ApiError('server', 'Something went wrong on the server. Please try again.'),
  )
  renderPopup()
  fillValid()

  await act(async () => fireEvent.click(addButton()))

  expect(screen.getByRole('alert').textContent).toBe(
    'Something went wrong on the server. Please try again.',
  )
  expect(field('Note (optional)').value).toBe('Lunch')
})

test("can't reach the server: message at the top, the banner, and the popup stays open", async () => {
  addExpense.mockRejectedValue(new ApiError('unreachable', "Can't reach the server."))
  renderPopup()
  fillValid()

  await act(async () => fireEvent.click(addButton()))

  expect(screen.getByRole('alert').textContent).toBe(
    "Can't reach the server. Check that the backend is running, then try again.",
  )
  expect(props.onUnreachable).toHaveBeenCalledTimes(1)
  expect(dialog().open).toBe(true)
  expect(field('Amount (Rs)').value).toBe('12.50')
})

// --- Closing ---

test('Cancel and Escape close the popup without saving', () => {
  renderPopup()
  fillValid()

  fireEvent.click(cancelButton())
  fireEvent(dialog(), new Event('cancel', { cancelable: true }))

  expect(props.onClose).toHaveBeenCalledTimes(2)
  expect(addExpense).not.toHaveBeenCalled()
})

// --- Category list changing while open (moved from the old add form) ---

function renamed(categories, id, name) {
  return categories.map((category) => (category.id === id ? { ...category, name } : category))
}

test('if the chosen category is renamed, the choice is cleared, even after renaming it back', () => {
  const popup = renderPopup()
  fireEvent.change(field('Category'), { target: { value: 'Food' } })

  popup.update(renamed(STARTING, 1, 'Groceries'))
  expect(field('Category').value).toBe('')

  popup.update(STARTING)
  expect(field('Category').value).toBe('')
})

test('if the chosen category is deleted, the choice is cleared, even if a new one gets the old name', () => {
  const popup = renderPopup()
  fireEvent.change(field('Category'), { target: { value: 'Other' } })

  const withoutOther = STARTING.filter((category) => category.name !== 'Other')
  popup.update(withoutOther)
  expect(field('Category').value).toBe('')

  popup.update([...withoutOther, { id: 7, name: 'Other' }])
  expect(field('Category').value).toBe('')
})

test('changes to other categories keep the choice and what was typed', () => {
  const popup = renderPopup()
  fillValid()

  popup.update([...renamed(STARTING, 4, 'Utilities'), { id: 7, name: 'Pets' }])

  expect(field('Category').value).toBe('Food')
  expect(field('Amount (Rs)').value).toBe('12.50')
})
