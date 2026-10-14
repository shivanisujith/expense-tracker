// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import ExpenseList from './ExpenseList.jsx'

afterEach(cleanup)

const noop = () => {}

function renderList(expenses, status = 'loaded') {
  return render(
    <ExpenseList
      expenses={expenses}
      status={status}
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
