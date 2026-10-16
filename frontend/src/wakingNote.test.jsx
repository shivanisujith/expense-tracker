// @vitest-environment jsdom
// The "Waking up the server" note (specs/frontend-spec.md, "Page title"),
// with a fake backend in place of api.js whose answers the test controls.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from './api.js'
import App from './App.jsx'

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

const NOTE = 'Waking up the server, this can take up to a minute...'
const SUMMARY = { month: '2026-10', total_spent_paise: 0, categories: [] }

// The summary's answer arrives only when the test calls answer().
let answer
let fail

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-10-15T06:00:00Z'))
  api.listExpenses.mockResolvedValue([])
  api.getMonths.mockResolvedValue([])
  api.getSummary.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        answer = () => resolve(SUMMARY)
        fail = () => reject(Object.assign(new Error('down'), { kind: 'unreachable' }))
      }),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const wait = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))
// Renders the page and lets the saved token's check finish, so the dashboard
// (whose first load the note is about) has started at time 0.
async function openPage() {
  render(<App />)
  await wait(0)
}
const note = () => screen.getByRole('status', { name: 'Server status' })

test('no note while the first load is quick', async () => {
  await openPage()
  await wait(4999)
  expect(note().textContent).toBe('')

  await act(async () => answer())
  await wait(10_000)
  expect(note().textContent).toBe('')
})

test('the note appears after 5 seconds of waiting, and goes when the data arrives', async () => {
  await openPage()
  await wait(5000)
  expect(note().textContent).toBe(NOTE)

  await act(async () => answer())
  expect(note().textContent).toBe('')
})

test('the note also goes when the first load fails', async () => {
  await openPage()
  await wait(5000)
  expect(note().textContent).toBe(NOTE)

  await act(async () => fail())
  expect(note().textContent).toBe('')
  expect(screen.getByText(/Can't reach the server/)).toBeTruthy()
})

test('later reloads never show the note, however slow', async () => {
  await openPage()
  await act(async () => answer())

  fireEvent.change(screen.getByRole('combobox', { name: 'Show expenses from' }), {
    target: { value: 'all' },
  })
  api.listExpenses.mockImplementation(() => new Promise(() => {}))
  await wait(30_000)
  expect(note().textContent).toBe('')
})

test('the status area is always there, so screen readers announce the note', async () => {
  await openPage()
  expect(note().getAttribute('aria-live')).toBe('polite')
  await act(async () => answer())
})
