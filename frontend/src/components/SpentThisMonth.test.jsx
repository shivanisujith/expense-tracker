// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import SpentThisMonth from './SpentThisMonth.jsx'

afterEach(cleanup)

// data is the summary (current month) or the month total (other months):
// either way, an object with total_spent_paise.
function renderBox({
  month = '2026-10',
  currentMonth = '2026-10',
  total = 9410,
  data = { total_spent_paise: total },
  status = 'loaded',
  earliest = '2026-07',
  onMonthChange = () => {},
} = {}) {
  return render(
    <SpentThisMonth
      month={month}
      currentMonth={currentMonth}
      data={data}
      status={status}
      earliestMonth={earliest}
      onMonthChange={onMonthChange}
    />,
  )
}

function boxText(container) {
  return [...container.querySelectorAll('p')].map((p) => p.textContent)
}

const previous = () => screen.getByRole('button', { name: 'Previous month' })
const next = () => screen.getByRole('button', { name: 'Next month' })

test('shows the label, the total from the summary, and the month', () => {
  const { container } = renderBox()
  expect(boxText(container)).toEqual(['Spent this month', 'Rs 94.10', 'October 2026'])
})

test("shows the backend's total, not a sum of the cards", () => {
  const data = { total_spent_paise: 12345, categories: [{ category_id: 1, spent_paise: 100 }] }
  renderBox({ data })
  expect(screen.getByText('Rs 123.45')).toBeTruthy()
})

test('shows Rs 0.00 when nothing was spent', () => {
  renderBox({ total: 0 })
  expect(screen.getByText('Rs 0.00')).toBeTruthy()
})

test.each([
  ['missing', undefined],
  ['null', null],
  ['text', '9410'],
  ['not whole paise', 94.1],
])('never shows NaN: a %s total shows "Rs –"', (_, total) => {
  const { container } = renderBox({ data: { total_spent_paise: total } })

  expect(container.textContent).not.toContain('NaN')
  expect(boxText(container)[1]).toBe('Rs –')
})

test('current month, while loading: label and "Loading...", no month', () => {
  const { container } = renderBox({ data: null, status: 'loading' })
  expect(boxText(container)).toEqual(['Spent this month', 'Loading...'])
})

test.each(['error', 'unreachable'])('current month, total can\'t load (%s): "Rs –", no month', (status) => {
  const { container } = renderBox({ data: null, status })
  expect(boxText(container)).toEqual(['Spent this month', 'Rs –'])
})

// --- Other months and the arrows (criterion 18) ---

test('another month: the label names the month, and there is no month line', () => {
  const { container } = renderBox({ month: '2026-09', total: 9210 })
  expect(boxText(container)).toEqual(['Spent in September 2026', 'Rs 92.10'])
})

test('another month, while loading or failed: the label stays, no month line', () => {
  const loading = renderBox({ month: '2026-09', data: null, status: 'loading' })
  expect(boxText(loading.container)).toEqual(['Spent in September 2026', 'Loading...'])
  loading.unmount()

  const failed = renderBox({ month: '2026-09', data: null, status: 'error' })
  expect(boxText(failed.container)).toEqual(['Spent in September 2026', 'Rs –'])
})

test('› is disabled on the current month; ‹ works', () => {
  const onMonthChange = vi.fn()
  renderBox({ onMonthChange })

  expect(next().disabled).toBe(true)
  expect(previous().disabled).toBe(false)
  fireEvent.click(previous())
  expect(onMonthChange).toHaveBeenCalledWith('2026-09')
})

test('on an earlier month both arrows work and move one month', () => {
  const onMonthChange = vi.fn()
  renderBox({ month: '2026-01', onMonthChange, earliest: '2025-06' })

  fireEvent.click(previous())
  fireEvent.click(next())
  expect(onMonthChange.mock.calls).toEqual([['2025-12'], ['2026-02']])
})

test('‹ is disabled on the month of the earliest expense', () => {
  renderBox({ month: '2026-07', earliest: '2026-07' })
  expect(previous().disabled).toBe(true)
  expect(next().disabled).toBe(false)
})

test('‹ is disabled with no expenses, or before the months list has loaded', () => {
  renderBox({ earliest: null })
  expect(previous().disabled).toBe(true)
})

test('› is never enabled past the current month', () => {
  renderBox({ month: '2026-11', currentMonth: '2026-10' })
  expect(next().disabled).toBe(true)
})

// --- The insight line (goal-spec criterion 23) ---

const INSIGHT = {
  previous_month: '2026-09',
  difference_paise: -62000,
  biggest_categories: [{ category_id: 1, category: 'Food' }],
}

test('the insight line sits right under the amount, above the month', () => {
  const { container } = renderBox({ data: { total_spent_paise: 9410, insight: INSIGHT } })
  expect(boxText(container)).toEqual([
    'Spent this month',
    'Rs 94.10',
    'Rs 620.00 less than September · Food is your biggest category',
    'October 2026',
  ])
})

test('an earlier month shows its own insight', () => {
  const august = { ...INSIGHT, previous_month: '2026-08', difference_paise: 100 }
  const { container } = renderBox({ month: '2026-09', data: { total_spent_paise: 9210, insight: august } })
  expect(boxText(container)).toEqual([
    'Spent in September 2026',
    'Rs 92.10',
    'Rs 1.00 more than August · Food is your biggest category',
  ])
})

test('no insight line while loading, or when the total can\'t be loaded', () => {
  const loading = renderBox({ data: null, status: 'loading' })
  expect(boxText(loading.container)).toEqual(['Spent this month', 'Loading...'])
  loading.unmount()

  const failed = renderBox({ data: null, status: 'error' })
  expect(boxText(failed.container)).toEqual(['Spent this month', 'Rs –'])
})

test('an unreadable insight is left out, and the total still shows', () => {
  const { container } = renderBox({ data: { total_spent_paise: 9410, insight: { difference_paise: 'x' } } })
  expect(boxText(container)).toEqual(['Spent this month', 'Rs 94.10', 'October 2026'])
  expect(container.textContent).not.toContain('NaN')
})

// --- The trend icon at the start of the comparison ---

function trendIcon(container) {
  return container.querySelector('.spent-insight svg')
}

test.each([
  ['less', -62000, 'down'],
  ['more', 100, 'up'],
  ['the same', 0, 'same'],
])('%s than the month before: its icon comes before the words', (_, difference, trend) => {
  const data = { total_spent_paise: 9410, insight: { ...INSIGHT, difference_paise: difference } }
  const { container } = renderBox({ data })

  const icon = trendIcon(container)
  expect(icon.getAttribute('class')).toBe(`trend-icon trend-${trend}`)
  // First thing in the line, before the words.
  expect(container.querySelector('.spent-insight').firstElementChild).toBe(icon)
})

test('the trend icon is hidden from screen readers; the words say it', () => {
  const { container } = renderBox({ data: { total_spent_paise: 9410, insight: INSIGHT } })

  expect(trendIcon(container).getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByText('Rs 620.00 less than September · Food is your biggest category')).toBeTruthy()
})

test('no comparison: no trend icon', () => {
  const noComparison = { ...INSIGHT, difference_paise: null }
  const { container } = renderBox({ data: { total_spent_paise: 9410, insight: noComparison } })

  expect(container.querySelector('.spent-insight').textContent).toBe('Food is your biggest category')
  expect(trendIcon(container)).toBeNull()
})
