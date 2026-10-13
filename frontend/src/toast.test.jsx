// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Toast from './components/Toast.jsx'
import { TOAST_MS, useToast } from './toast.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('a message shows and disappears after about 3 seconds', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('Expense added'))
  expect(result.current.toast.message).toBe('Expense added')

  act(() => vi.advanceTimersByTime(TOAST_MS - 1))
  expect(result.current.toast.message).toBe('Expense added')

  act(() => vi.advanceTimersByTime(1))
  expect(result.current.toast).toBeNull()
})

test('a new message replaces the current one and restarts the 3 seconds', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('Expense added'))
  act(() => vi.advanceTimersByTime(2000))
  act(() => result.current.showToast('Limit saved'))
  act(() => vi.advanceTimersByTime(2000))

  expect(result.current.toast.message).toBe('Limit saved')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.toast).toBeNull()
})

test('the same message twice counts as a new toast', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('Expense deleted'))
  const firstKey = result.current.toast.key
  act(() => result.current.showToast('Expense deleted'))

  expect(result.current.toast.key).not.toBe(firstKey)
})

test('clearToast removes it straight away', () => {
  const { result } = renderHook(() => useToast())

  act(() => result.current.showToast('Category added'))
  act(() => result.current.clearToast())

  expect(result.current.toast).toBeNull()
})

test('the status area is always present for screen readers', () => {
  const { rerender } = render(<Toast toast={null} />)
  const region = screen.getByRole('status')
  expect(region.getAttribute('aria-live')).toBe('polite')
  expect(region.textContent).toBe('')

  rerender(<Toast toast={{ message: 'Category renamed', key: 1 }} />)
  expect(screen.getByRole('status').textContent).toBe('Category renamed')
})
