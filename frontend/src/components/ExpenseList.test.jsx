// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ExpenseList from './ExpenseList.jsx'

// Every test runs on 16 Oct 2026 in India.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-16T06:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const noop = () => {}

function renderList(expenses, status = 'loaded', monthProps = {}) {
  return render(
    <ExpenseList
      expenses={expenses}
      status={status}
      month="all"
      monthChoices={['2026-10', '2026-09']}
      onMonthChange={noop}
      {...monthProps}
      success={null}
      onRetry={noop}
      onEdit={noop}
      onDeleted={noop}
      onReload={noop}
      onUnreachable={noop}
    />,
  )
}

// --- Friendlier rows (specs/frontend-spec.md, "Expense list") ---

function expense(changes) {
  return {
    id: 1,
    amount_paise: 1250,
    category: 'Food',
    category_id: 1,
    icon: 'food',
    date: '2026-10-16',
    note: 'Lunch',
    ...changes,
  }
}

function rows(container) {
  return [...container.querySelectorAll('.expense-row')].map((row) => ({
    title: row.querySelector('.expense-title').textContent,
    meta: row.querySelector('.expense-meta').textContent,
    amount: row.querySelector('.expense-amount').textContent,
  }))
}

test('the note is the main text, with "Category · day" underneath', () => {
  const { container } = renderList([expense({})])
  expect(rows(container)).toEqual([{ title: 'Lunch', meta: 'Food · Today', amount: 'Rs 12.50' }])
})

test('with no note, the category is the main text and only the day is underneath', () => {
  const { container } = renderList([expense({ note: '', category: 'Bills', category_id: 4, date: '2026-10-15' })])
  expect(rows(container)).toEqual([{ title: 'Bills', meta: 'Yesterday', amount: 'Rs 12.50' }])
})

test('older days show a short date, with the year only for other years', () => {
  const { container } = renderList([
    expense({ id: 3, date: '2026-10-02', note: 'Bus' }),
    expense({ id: 2, date: '2025-12-31', note: '' }),
  ])
  expect(rows(container).map((row) => row.meta)).toEqual(['Food · 2 Oct', '31 Dec 2025'])
})

test('each row is: icon, the two lines of text, the amount, then edit and delete', () => {
  const { container } = renderList([expense({})])
  const parts = [...container.querySelector('.expense-row').children].map((child) => child.className)
  expect(parts).toEqual(['category-icon', 'expense-text', 'expense-amount', 'item-buttons'])
  expect(screen.getByRole('button', { name: 'Edit expense' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Delete expense' })).toBeTruthy()
})

test('screen readers read note, category and day, then amount, in that order', () => {
  const { container } = renderList([expense({})])
  expect(container.querySelector('.expense-row').textContent).toBe('LunchFood · TodayRs 12.50')
})

test('there are no column headings any more', () => {
  const { container } = renderList([expense({})])
  expect(container.querySelector('.expense-headings')).toBeNull()
  for (const heading of ['Date', 'Category', 'Note', 'Amount']) {
    expect(screen.queryByText(heading, { exact: true })).toBeNull()
  }
})

test('a long note keeps everything in the row', () => {
  const longNote = 'Birthday dinner for the whole family at the new place near the station'
  const { container } = renderList([expense({ note: longNote })])
  expect(rows(container)).toEqual([{ title: longNote, meta: 'Food · Today', amount: 'Rs 12.50' }])
})

// --- Month choice (criterion 20) ---

const monthSelect = () => screen.getByRole('combobox', { name: 'Show expenses from' })

test('the month choice offers "All months", then the given months by name, newest first', () => {
  renderList([], 'loaded', { month: '2026-10', monthChoices: ['2026-10', '2026-09', '2025-12'] })

  const options = [...monthSelect().options].map((option) => [option.value, option.textContent])
  expect(options).toEqual([
    ['all', 'All months'],
    ['2026-10', 'October 2026'],
    ['2026-09', 'September 2026'],
    ['2025-12', 'December 2025'],
  ])
  expect(monthSelect().value).toBe('2026-10')
})

test('choosing a month tells the page which one', () => {
  const onMonthChange = vi.fn()
  renderList([], 'loaded', { month: '2026-10', onMonthChange })

  fireEvent.change(monthSelect(), { target: { value: '2026-09' } })
  fireEvent.change(monthSelect(), { target: { value: 'all' } })
  expect(onMonthChange.mock.calls).toEqual([['2026-09'], ['all']])
})

test('a chosen month with no expenses says so, by name', () => {
  renderList([], 'loaded', { month: '2026-09' })
  expect(screen.getByText('No expenses in September 2026.')).toBeTruthy()
  expect(screen.queryByText('No expenses yet. Add your first one above.')).toBeNull()
})

test('"All months" with no expenses keeps the first-expense message', () => {
  renderList([], 'loaded', { month: 'all' })
  expect(screen.getByText('No expenses yet. Add your first one above.')).toBeTruthy()
})

// --- Category icons on rows ---

test('each expense row shows its category icon, from the icon value (not the id)', () => {
  const { container } = renderList([
    { id: 3, amount_paise: 500, category: 'Groceries', category_id: 1, icon: 'food', date: '2026-10-07', note: '' },
    { id: 2, amount_paise: 700, category: 'Bills', category_id: 10, icon: 'bills', date: '2026-10-07', note: '' },
    { id: 1, amount_paise: 900, category: 'Pets', category_id: 4, icon: 'tag', date: '2026-10-06', note: 'Food' },
  ])

  const icons = [...container.querySelectorAll('.expense-item .category-icon')]
  expect(icons.map((icon) => icon.dataset.icon)).toEqual(['food', 'bills', 'tag'])
  expect(icons.every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true)
})
