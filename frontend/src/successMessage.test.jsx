// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import CategoryCards from './components/CategoryCards.jsx'
import SuccessMessage from './components/SuccessMessage.jsx'
import { SUCCESS_MS, useSuccessMessage } from './successMessage.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('a message shows in its place and disappears after about 3 seconds', () => {
  const { result } = renderHook(() => useSuccessMessage())

  act(() => result.current.showSuccess('Expense added', 'add-form'))
  expect(result.current.success).toMatchObject({ message: 'Expense added', place: 'add-form' })

  act(() => vi.advanceTimersByTime(SUCCESS_MS - 1))
  expect(result.current.success).not.toBeNull()

  act(() => vi.advanceTimersByTime(1))
  expect(result.current.success).toBeNull()
})

test('a new message replaces the current one, moves to its own place, and restarts the 3 seconds', () => {
  const { result } = renderHook(() => useSuccessMessage())

  act(() => result.current.showSuccess('Expense added', 'add-form'))
  act(() => vi.advanceTimersByTime(2000))
  act(() => result.current.showSuccess('Limit saved', 'card-3'))
  act(() => vi.advanceTimersByTime(2000))

  expect(result.current.success).toMatchObject({ message: 'Limit saved', place: 'card-3' })
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.success).toBeNull()
})

test('the same message twice counts as a new message', () => {
  const { result } = renderHook(() => useSuccessMessage())

  act(() => result.current.showSuccess('Expense deleted', 'expenses'))
  const firstKey = result.current.success.key
  act(() => result.current.showSuccess('Expense deleted', 'expenses'))

  expect(result.current.success.key).not.toBe(firstKey)
})

test('clearSuccess removes it straight away', () => {
  const { result } = renderHook(() => useSuccessMessage())

  act(() => result.current.showSuccess('Category added', 'categories'))
  act(() => result.current.clearSuccess())

  expect(result.current.success).toBeNull()
})

test('the status area is always present for screen readers', () => {
  const { rerender } = render(<SuccessMessage success={null} />)
  const region = screen.getByRole('status')
  expect(region.getAttribute('aria-live')).toBe('polite')
  expect(region.textContent).toBe('')

  rerender(<SuccessMessage success={{ message: 'Category renamed', key: 1 }} />)
  expect(screen.getByRole('status').textContent).toBe('✓ Category renamed')
})

test('"Limit saved" shows only inside the card whose limit was saved', () => {
  const row = (id, name) => ({
    category_id: id,
    category: name,
    spent_paise: 0,
    limit_paise: null,
    remaining_paise: null,
    over_limit: false,
  })
  const summary = { month: '2026-10', categories: [row(1, 'Food'), row(2, 'Transport')] }
  const noop = () => {}

  render(
    <CategoryCards
      summary={summary}
      status="loaded"
      success={{ message: 'Limit saved', place: 'card-2', key: 1 }}
      onRetry={noop}
      onLimitSaved={noop}
      onManage={noop}
      onUnreachable={noop}
    />,
  )

  const [foodCard, transportCard] = screen.getAllByRole('listitem')
  expect(foodCard.textContent).not.toContain('Limit saved')
  expect(transportCard.textContent).toContain('✓ Limit saved')
})
