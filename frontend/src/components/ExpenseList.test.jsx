// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ExpenseList from './ExpenseList.jsx'

afterEach(cleanup)

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

function headingTexts(container) {
  const headings = container.querySelector('.expense-headings')
  return headings ? [...headings.children].map((child) => child.textContent) : null
}

test('shows Date, Category, Note and Amount headings above the expenses', () => {
  const { container } = renderList([
    { id: 1, amount_paise: 1250, category: 'Food', date: '2026-10-07', note: 'Lunch' },
  ])

  expect(headingTexts(container)).toEqual(['Date', 'Category', 'Note', 'Amount', ''])
  // Headings come first, then the rows, in the same column layout.
  const table = container.querySelector('.expense-table')
  expect(table.firstElementChild.className).toBe('expense-headings')
  expect(table.querySelectorAll('.expense-row')).toHaveLength(1)
})

test('no headings when the list is empty', () => {
  const { container } = renderList([])

  expect(screen.getByText('No expenses yet. Add your first one above.')).toBeTruthy()
  expect(headingTexts(container)).toBeNull()
})

test('no headings while loading or when the list fails to load', () => {
  const loading = renderList(null, 'loading')
  expect(headingTexts(loading.container)).toBeNull()
  loading.unmount()

  const failed = renderList(null, 'error')
  expect(headingTexts(failed.container)).toBeNull()
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
