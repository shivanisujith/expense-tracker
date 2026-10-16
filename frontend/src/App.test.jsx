// @vitest-environment jsdom
// The whole page, with a fake backend in place of api.js (no server is used).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from './api.js'
import App from './App.jsx'
import './dialogStub.js'

// Already logged in: a saved token that the fake backend accepts, so the
// page opens on the dashboard (logging in is tested in login.test.jsx).
vi.mock('./api.js', () => ({
  savedToken: vi.fn(() => 'token'),
  whoAmI: vi.fn(async () => ({ username: 'tester' })),
  onSessionEnded: vi.fn(() => () => {}),
  logIn: vi.fn(),
  signUp: vi.fn(),
  logOut: vi.fn(),
  listExpenses: vi.fn(),
  getSummary: vi.fn(),
  getMonths: vi.fn(),
  getMonthTotal: vi.fn(),
  addExpense: vi.fn(),
  editExpense: vi.fn(),
  deleteExpense: vi.fn(),
  setLimit: vi.fn(),
  addCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

let expenses
let nextId

const inMonth = (month) => (expense) => expense.date.startsWith(month)
const sum = (list) => list.reduce((total, expense) => total + expense.amount_paise, 0)

beforeEach(() => {
  // 14 Oct 2026 in India.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T06:00:00Z'))

  expenses = [
    { id: 3, amount_paise: 9210, category: 'Food', date: '2026-10-02', note: 'October lunch' },
    { id: 2, amount_paise: 200, category: 'Food', date: '2026-09-23', note: 'September snack' },
    { id: 1, amount_paise: 5000, category: 'Bills', date: '2026-07-05', note: 'July bill' },
  ]
  nextId = 4

  api.listExpenses.mockImplementation(async (month) => (month ? expenses.filter(inMonth(month)) : expenses))
  api.getMonths.mockImplementation(async () =>
    [...new Set(expenses.map((expense) => expense.date.slice(0, 7)))].sort().reverse(),
  )
  api.getMonthTotal.mockImplementation(async (month) => ({
    month,
    total_spent_paise: sum(expenses.filter(inMonth(month))),
  }))
  api.getSummary.mockImplementation(async () => ({
    month: '2026-10',
    total_spent_paise: sum(expenses.filter(inMonth('2026-10'))),
    categories: ['Food', 'Bills'].map((name, index) => ({
      category_id: index + 1,
      category: name,
      spent_paise: 0,
      limit_paise: null,
      remaining_paise: null,
      over_limit: false,
    })),
  }))
  api.addExpense.mockImplementation(async (expense) => {
    const saved = { id: nextId++, note: '', ...expense }
    expenses = [saved, ...expenses].sort((a, b) => b.date.localeCompare(a.date))
    return saved
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const spentBox = () => within(screen.getByRole('region', { name: /^Spent/ }))
const monthSelect = () => screen.getByRole('combobox', { name: 'Show expenses from' })
// Each row's main text is its note (every fake expense here has one).
const listedNotes = () => [...document.querySelectorAll('.expense-title')].map((note) => note.textContent)

async function openPage() {
  render(<App />)
  await waitFor(() => expect(spentBox().getByText('Rs 92.10')).toBeTruthy())
  await waitFor(() => expect(listedNotes()).toEqual(['October lunch']))
}

test('the page starts on the current month in both the box and the list', async () => {
  await openPage()

  expect(spentBox().getByText('Spent this month')).toBeTruthy()
  expect(spentBox().getByText('October 2026')).toBeTruthy()
  expect(monthSelect().value).toBe('2026-10')
  // The backend does the filtering.
  expect(api.listExpenses).toHaveBeenCalledWith('2026-10')
  expect(api.listExpenses).not.toHaveBeenCalledWith(null)
})

test('the arrows show earlier months, without changing the list', async () => {
  await openPage()

  fireEvent.click(spentBox().getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(spentBox().getByText('Rs 2.00')).toBeTruthy())
  expect(spentBox().getByText('Spent in September 2026')).toBeTruthy()
  expect(api.getMonthTotal).toHaveBeenCalledWith('2026-09')

  // August has no expenses but is not skipped.
  fireEvent.click(spentBox().getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(spentBox().getByText('Rs 0.00')).toBeTruthy())
  fireEvent.click(spentBox().getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(spentBox().getByText('Rs 50.00')).toBeTruthy())
  // July has the earliest expense.
  expect(spentBox().getByRole('button', { name: 'Previous month' }).disabled).toBe(true)

  expect(monthSelect().value).toBe('2026-10')
  expect(listedNotes()).toEqual(['October lunch'])
})

test('the month choice lists one month or all, without changing the box', async () => {
  await openPage()
  expect([...monthSelect().options].map((option) => option.textContent)).toEqual([
    'All months',
    'October 2026',
    'September 2026',
    'July 2026',
  ])

  fireEvent.change(monthSelect(), { target: { value: '2026-09' } })
  await waitFor(() => expect(listedNotes()).toEqual(['September snack']))
  expect(api.listExpenses).toHaveBeenLastCalledWith('2026-09')

  fireEvent.change(monthSelect(), { target: { value: 'all' } })
  await waitFor(() => expect(listedNotes()).toEqual(['October lunch', 'September snack', 'July bill']))
  expect(api.listExpenses).toHaveBeenLastCalledWith(null)

  expect(spentBox().getByText('Spent this month')).toBeTruthy()
  expect(spentBox().getByText('Rs 92.10')).toBeTruthy()
})

test('after adding an expense, the list and the box keep their chosen months', async () => {
  await openPage()
  fireEvent.change(monthSelect(), { target: { value: '2026-09' } })
  await waitFor(() => expect(listedNotes()).toEqual(['September snack']))
  fireEvent.click(spentBox().getByRole('button', { name: 'Previous month' }))
  await waitFor(() => expect(spentBox().getByText('Rs 2.00')).toBeTruthy())

  addThroughPopup({ amount: '3.00', category: 'Food', date: '2026-09-25', note: 'Tea' })

  await waitFor(() => expect(listedNotes()).toEqual(['Tea', 'September snack']))
  await waitFor(() => expect(spentBox().getByText('Rs 5.00')).toBeTruthy())
  expect(monthSelect().value).toBe('2026-09')
  expect(spentBox().getByText('Spent in September 2026')).toBeTruthy()
})

test('a chosen month whose last expense is deleted stays chosen and says it is empty', async () => {
  await openPage()
  fireEvent.change(monthSelect(), { target: { value: '2026-09' } })
  await waitFor(() => expect(listedNotes()).toEqual(['September snack']))

  api.deleteExpense.mockImplementation(async (id) => {
    expenses = expenses.filter((expense) => expense.id !== id)
    return null
  })
  fireEvent.click(screen.getByRole('button', { name: 'Delete expense' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(screen.getByText('No expenses in September 2026.')).toBeTruthy())
  expect(monthSelect().value).toBe('2026-09')
  expect([...monthSelect().options].map((option) => option.value)).toEqual(['all', '2026-10', '2026-09', '2026-07'])
})

// --- The Add expense popup (specs/frontend-spec.md, section 2) ---

const openAddButton = () => screen.getByRole('button', { name: '+ Add expense' })
const addPopup = () => screen.queryByRole('dialog', { name: 'Add expense' })

function addThroughPopup({ amount, category, date, note }) {
  fireEvent.click(openAddButton())
  const popup = within(addPopup())
  fireEvent.change(popup.getByLabelText('Amount (Rs)'), { target: { value: amount } })
  fireEvent.change(popup.getByLabelText('Category'), { target: { value: category } })
  fireEvent.change(popup.getByLabelText('Date'), { target: { value: date } })
  fireEvent.change(popup.getByLabelText('Note (optional)'), { target: { value: note } })
  fireEvent.click(popup.getByRole('button', { name: 'Add expense' }))
}

test('the + Add expense button sits in the page title row, and there is no add form box', async () => {
  await openPage()

  const titleRow = document.querySelector('header.page-title')
  expect(within(titleRow).getByRole('button', { name: '+ Add expense' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Add expense' })).toBeNull()
  expect(addPopup()).toBeNull()
})

test('adding through the popup closes it and shows "Expense added" in the Expenses box', async () => {
  await openPage()

  addThroughPopup({ amount: '4.00', category: 'Bills', date: '2026-10-14', note: 'Phone top-up' })

  await waitFor(() => expect(addPopup()).toBeNull())
  const expensesBox = within(document.querySelector('.expense-section'))
  await waitFor(() => expect(expensesBox.getByRole('status').textContent).toBe('✓ Expense added'))
  await waitFor(() => expect(listedNotes()).toEqual(['Phone top-up', 'October lunch']))
  await waitFor(() => expect(spentBox().getByText('Rs 96.10')).toBeTruthy())
})

test('Cancel discards what was typed: the popup opens fresh next time', async () => {
  await openPage()
  fireEvent.click(openAddButton())
  fireEvent.change(within(addPopup()).getByLabelText('Amount (Rs)'), { target: { value: '99' } })

  fireEvent.click(within(addPopup()).getByRole('button', { name: 'Cancel' }))
  expect(addPopup()).toBeNull()
  expect(api.addExpense).not.toHaveBeenCalled()

  fireEvent.click(openAddButton())
  expect(within(addPopup()).getByLabelText('Amount (Rs)').value).toBe('')
})

test('after the popup closes, the cursor goes back to the + Add expense button', async () => {
  await openPage()
  fireEvent.click(openAddButton())
  fireEvent.click(within(addPopup()).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(document.activeElement).toBe(openAddButton()))
})

test('the + Add expense button works even when the server can\'t be reached', async () => {
  const down = Object.assign(new Error('down'), { kind: 'unreachable' })
  for (const call of [api.listExpenses, api.getSummary, api.getMonths]) call.mockRejectedValue(down)
  render(<App />)
  await waitFor(() => expect(screen.getByText(/Can't reach the server/)).toBeTruthy())

  fireEvent.click(openAddButton())
  expect(addPopup()).toBeTruthy()
})
