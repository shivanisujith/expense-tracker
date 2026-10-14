// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import SpentThisMonth from './SpentThisMonth.jsx'

afterEach(cleanup)

function summary(total, month = '2026-10') {
  return { month, total_spent_paise: total, categories: [] }
}

function boxText(container) {
  return [...container.querySelectorAll('p')].map((p) => p.textContent)
}

test('shows the label, the total from the summary, and the month', () => {
  const { container } = render(<SpentThisMonth summary={summary(9410)} status="loaded" />)

  expect(boxText(container)).toEqual(['Spent this month', 'Rs 94.10', 'October 2026'])
})

test("shows the backend's total, not a sum of the cards", () => {
  const data = {
    month: '2026-10',
    total_spent_paise: 12345,
    categories: [{ category_id: 1, category: 'Food', spent_paise: 100 }],
  }
  render(<SpentThisMonth summary={data} status="loaded" />)

  expect(screen.getByText('Rs 123.45')).toBeTruthy()
})

test('shows Rs 0.00 when nothing was spent this month', () => {
  render(<SpentThisMonth summary={summary(0)} status="loaded" />)
  expect(screen.getByText('Rs 0.00')).toBeTruthy()
})

test.each([
  ['missing', undefined],
  ['null', null],
  ['text', '9410'],
  ['not whole paise', 94.1],
])('never shows NaN: a %s total shows "Rs –"', (_, total) => {
  const { container } = render(<SpentThisMonth summary={summary(total)} status="loaded" />)

  expect(container.textContent).not.toContain('NaN')
  expect(boxText(container)[1]).toBe('Rs –')
})

test('while loading: label and "Loading...", no month', () => {
  const { container } = render(<SpentThisMonth summary={null} status="loading" />)
  expect(boxText(container)).toEqual(['Spent this month', 'Loading...'])
})

test.each(['error', 'unreachable'])('when the summary can\'t load (%s): "Rs –", no month', (status) => {
  const { container } = render(<SpentThisMonth summary={null} status={status} />)
  expect(boxText(container)).toEqual(['Spent this month', 'Rs –'])
})
