// @vitest-environment jsdom
// Logging in, signing up, logging out, staying logged in, and what happens
// when a session ends (specs/frontend-spec.md, "Logging in"). A fake backend
// stands in for api.js, so no server is used.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from './api.js'
import App from './App.jsx'
import './dialogStub.js'

vi.mock('./api.js', () => ({
  savedToken: vi.fn(),
  onSessionEnded: vi.fn(),
  whoAmI: vi.fn(),
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

const SUBTITLE = 'Log in to see your spending · Wednesday, 14 October 2026'
const UNREACHABLE_MESSAGE = "Can't reach the server. Check that the backend is running, then try again."
const EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

function apiError(kind, message, extra = {}) {
  return Object.assign(new Error(message), { kind, field: null, code: null, ...extra })
}

const unreachable = () => apiError('unreachable', "Can't reach the server.")
const session = (username) => ({ username, token: 'token', expires_at: '2026-10-21T06:00:00Z' })

// The page calls this when any data request answers 401.
let endSession

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T06:00:00Z'))
  api.savedToken.mockReturnValue(null)
  api.onSessionEnded.mockImplementation((handler) => {
    endSession = handler
    return () => {}
  })
  api.logOut.mockResolvedValue(undefined)
  api.listExpenses.mockResolvedValue([
    { id: 1, amount_paise: 1250, category: 'Food', category_id: 1, icon: 'food', date: '2026-10-14', note: 'Lunch' },
  ])
  api.getMonths.mockResolvedValue(['2026-10'])
  api.getSummary.mockResolvedValue({
    month: '2026-10',
    total_spent_paise: 1250,
    insight: null,
    categories: [
      {
        category_id: 1,
        category: 'Food',
        icon: 'food',
        spent_paise: 1250,
        limit_paise: null,
        remaining_paise: null,
        over_limit: false,
      },
    ],
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const loginBox = () => within(screen.getByRole('region', { name: /^(Log in|Create an account)$/ }))
const usernameField = () => screen.getByLabelText('Username')
const passwordField = () => screen.getByLabelText('Password')
const dashboardLoaded = () => waitFor(() => expect(screen.getByText('Lunch')).toBeTruthy())

function type(field, value) {
  fireEvent.change(field, { target: { value } })
}

function fillAndSend(username, password, button = 'Log in') {
  type(usernameField(), username)
  type(passwordField(), password)
  fireEvent.click(loginBox().getByRole('button', { name: button }))
}

function switchToSignUp() {
  fireEvent.click(screen.getByRole('button', { name: 'New here? Create an account' }))
}

// --- The log in screen ------------------------------------------------------

test('with no saved token, the log in screen shows instead of the dashboard', () => {
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: 'Expense Tracker' })).toBeTruthy()
  expect(screen.getByText(SUBTITLE)).toBeTruthy()
  expect(loginBox().getByRole('heading', { name: 'Log in' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '+ Add expense' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull()
  expect(api.getSummary).not.toHaveBeenCalled()
  expect(api.listExpenses).not.toHaveBeenCalled()
  expect(api.whoAmI).not.toHaveBeenCalled()
})

test('the fields have visible labels, the password is hidden, and the cursor starts in Username', () => {
  render(<App />)

  expect(usernameField().tagName).toBe('INPUT')
  expect(usernameField().getAttribute('autocomplete')).toBe('username')
  expect(passwordField().getAttribute('type')).toBe('password')
  expect(passwordField().getAttribute('autocomplete')).toBe('current-password')
  for (const label of document.querySelectorAll('.login-box label')) {
    expect(label.textContent.trim()).not.toBe('')
  }
  expect(document.activeElement).toBe(usernameField())
})

test('logging in opens the dashboard with a greeting', async () => {
  api.logIn.mockResolvedValue(session('alice'))
  render(<App />)

  fillAndSend('Alice', 'a good password')

  await dashboardLoaded()
  expect(api.logIn).toHaveBeenCalledWith('Alice', 'a good password')
  expect(screen.getByText("Hi alice, here's your spending · Wednesday, 14 October 2026")).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Log in' })).toBeNull()
})

test('pressing Enter in the password field sends the form', async () => {
  api.logIn.mockResolvedValue(session('alice'))
  render(<App />)
  type(usernameField(), 'alice')
  type(passwordField(), 'a good password')

  fireEvent.submit(passwordField().form)

  await dashboardLoaded()
})

test('while sending, the button says "Logging in..." and is disabled', async () => {
  let finish
  api.logIn.mockImplementation(() => new Promise((resolve) => (finish = () => resolve(session('alice')))))
  render(<App />)

  fillAndSend('alice', 'a good password')

  const button = loginBox().getByRole('button', { name: 'Logging in...' })
  expect(button.disabled).toBe(true)
  await act(async () => finish())
  await dashboardLoaded()
})

test('empty fields are refused before anything is sent', () => {
  render(<App />)

  fillAndSend('   ', '')

  expect(loginBox().getByText('Please enter a username.')).toBeTruthy()
  expect(loginBox().getByText('Please enter a password.')).toBeTruthy()
  expect(usernameField().getAttribute('aria-invalid')).toBe('true')
  expect(usernameField().getAttribute('aria-describedby')).toBe('login-username-error')
  expect(api.logIn).not.toHaveBeenCalled()
})

test('a wrong username or password shows at the top, clears the password and keeps the username', async () => {
  api.logIn.mockRejectedValue(
    apiError('unauthorized', 'Username or password is incorrect.', { code: 'wrong_login' }),
  )
  render(<App />)

  fillAndSend('alice', 'not the password')

  await waitFor(() => expect(loginBox().getByText('Username or password is incorrect.')).toBeTruthy())
  expect(loginBox().getByText('Username or password is incorrect.').className).toContain('form-error')
  expect(passwordField().value).toBe('')
  expect(usernameField().value).toBe('alice')
})

test('a server error shows at the top and keeps what was typed', async () => {
  api.logIn.mockRejectedValue(apiError('server', 'Something went wrong on the server. Please try again.'))
  render(<App />)

  fillAndSend('alice', 'a good password')

  await waitFor(() =>
    expect(loginBox().getByText('Something went wrong on the server. Please try again.')).toBeTruthy(),
  )
  expect(passwordField().value).toBe('a good password')
})

// --- Show and hide the password ---------------------------------------------------

const toggle = () => loginBox().getByRole('button', { name: /^(Show|Hide) password$/ })
// Which icon the button shows: the eye with a line (hidden) or the open eye.
const toggleIcon = () => toggle().querySelector('svg').getAttribute('class')

test('the password starts hidden, with a "Show password" button showing the crossed-out eye', () => {
  render(<App />)

  expect(passwordField().getAttribute('type')).toBe('password')
  expect(toggle().getAttribute('aria-label')).toBe('Show password')
  expect(toggle().getAttribute('title')).toBe('Show password')
  expect(toggleIcon()).toBe('icon-eye-off')
  expect(toggle().querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  // Inside the Password field's box, next to the input.
  expect(passwordField().closest('.password-wrap').contains(toggle())).toBe(true)
})

test('clicking it shows the password, and clicking again hides it, keeping what was typed', () => {
  render(<App />)
  type(usernameField(), 'alice')
  type(passwordField(), 'a good password')
  toggle().focus()

  fireEvent.click(toggle())

  expect(passwordField().getAttribute('type')).toBe('text')
  expect(toggle().getAttribute('aria-label')).toBe('Hide password')
  expect(toggle().getAttribute('title')).toBe('Hide password')
  expect(toggleIcon()).toBe('icon-eye')
  expect(passwordField().value).toBe('a good password')
  expect(document.activeElement).toBe(toggle())

  fireEvent.click(toggle())

  expect(passwordField().getAttribute('type')).toBe('password')
  expect(toggle().getAttribute('aria-label')).toBe('Show password')
  expect(toggleIcon()).toBe('icon-eye-off')
  expect(passwordField().value).toBe('a good password')
})

test('it never sends the form', () => {
  render(<App />)
  type(usernameField(), 'alice')
  type(passwordField(), 'a good password')

  fireEvent.click(toggle())
  fireEvent.click(toggle())

  expect(toggle().getAttribute('type')).toBe('button')
  expect(api.logIn).not.toHaveBeenCalled()
  expect(api.signUp).not.toHaveBeenCalled()
  expect(loginBox().getByRole('button', { name: 'Log in' }).disabled).toBe(false)
})

test('it works with the keyboard: a real button, next in the Tab order after Password', () => {
  render(<App />)

  // A native <button> is reached with Tab and pressed with Enter or Space.
  expect(toggle().tagName).toBe('BUTTON')
  expect(toggle().disabled).toBe(false)
  expect(toggle().getAttribute('tabindex')).toBeNull()
  const focusable = [...document.querySelectorAll('.login-box input, .login-box button')]
  expect(focusable.indexOf(toggle())).toBe(focusable.indexOf(passwordField()) + 1)
})

test('switching between Log in and Create account hides the password again, keeping it', () => {
  render(<App />)
  type(passwordField(), 'a good password')
  fireEvent.click(toggle())

  switchToSignUp()

  expect(passwordField().getAttribute('type')).toBe('password')
  expect(toggle().getAttribute('aria-label')).toBe('Show password')
  expect(passwordField().value).toBe('a good password')

  fireEvent.click(toggle())
  fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Log in' }))

  expect(passwordField().getAttribute('type')).toBe('password')
  expect(passwordField().value).toBe('a good password')
})

test('a failed log in hides the password again', async () => {
  api.logIn.mockRejectedValue(apiError('server', 'Something went wrong on the server. Please try again.'))
  render(<App />)
  type(usernameField(), 'alice')
  type(passwordField(), 'a good password')
  fireEvent.click(toggle())

  fireEvent.click(loginBox().getByRole('button', { name: 'Log in' }))

  await waitFor(() =>
    expect(loginBox().getByText('Something went wrong on the server. Please try again.')).toBeTruthy(),
  )
  expect(passwordField().getAttribute('type')).toBe('password')
  expect(toggle().getAttribute('aria-label')).toBe('Show password')
  expect(passwordField().value).toBe('a good password')
})

test('a wrong log in hides the password again', async () => {
  api.logIn.mockRejectedValue(
    apiError('unauthorized', 'Username or password is incorrect.', { code: 'wrong_login' }),
  )
  render(<App />)
  type(usernameField(), 'alice')
  type(passwordField(), 'not the password')
  fireEvent.click(toggle())

  fireEvent.click(loginBox().getByRole('button', { name: 'Log in' }))

  await waitFor(() => expect(loginBox().getByText('Username or password is incorrect.')).toBeTruthy())
  expect(passwordField().getAttribute('type')).toBe('password')
})

test('a failed sign-up hides the password again', async () => {
  api.signUp.mockRejectedValue(
    apiError('invalid', 'That username is already taken.', { field: 'username', code: 'username_taken' }),
  )
  render(<App />)
  switchToSignUp()
  type(usernameField(), 'alice')
  type(passwordField(), 'a good password')
  fireEvent.click(toggle())

  fireEvent.click(loginBox().getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(loginBox().getByText('That username is already taken.')).toBeTruthy())
  expect(passwordField().getAttribute('type')).toBe('password')
  expect(passwordField().value).toBe('a good password')
})

// --- Creating an account --------------------------------------------------------

test('the switch changes to "Create an account", clearing messages but keeping what was typed', () => {
  render(<App />)
  fillAndSend('', 'typed password')
  expect(loginBox().getByText('Please enter a username.')).toBeTruthy()

  switchToSignUp()

  expect(loginBox().getByRole('heading', { name: 'Create an account' })).toBeTruthy()
  expect(loginBox().getByRole('button', { name: 'Create account' })).toBeTruthy()
  expect(loginBox().queryByText('Please enter a username.')).toBeNull()
  expect(passwordField().value).toBe('typed password')
  expect(passwordField().getAttribute('autocomplete')).toBe('new-password')

  fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Log in' }))
  expect(loginBox().getByRole('heading', { name: 'Log in' })).toBeTruthy()
})

test('only "Create an account" warns not to reuse a password, in normal text', () => {
  const warning = "This is a demo. Don't use a password you use anywhere else."
  render(<App />)
  expect(loginBox().queryByText(warning)).toBeNull()

  switchToSignUp()

  const shown = loginBox().getByText(warning)
  expect(shown.className).toBe('login-warning')
  expect(shown.className).not.toContain('error')
})

test('creating an account checks the backend\'s rules first, and sends nothing if one fails', () => {
  render(<App />)
  switchToSignUp()

  fillAndSend('ab', 'short', 'Create account')

  expect(
    loginBox().getByText('Username must be 3 to 20 characters, using only letters, numbers and underscores.'),
  ).toBeTruthy()
  expect(loginBox().getByText('Password must be at least 8 characters.')).toBeTruthy()
  expect(api.signUp).not.toHaveBeenCalled()
})

test('creating an account opens the dashboard', async () => {
  let finish
  api.signUp.mockImplementation(() => new Promise((resolve) => (finish = () => resolve(session('newbie')))))
  render(<App />)
  switchToSignUp()

  fillAndSend('NewBie', 'a good password', 'Create account')

  expect(loginBox().getByRole('button', { name: 'Creating account...' }).disabled).toBe(true)
  await act(async () => finish())
  await dashboardLoaded()
  expect(api.signUp).toHaveBeenCalledWith('NewBie', 'a good password')
  expect(screen.getByText(/^Hi newbie, here's your spending/)).toBeTruthy()
})

test('a refusal from the backend shows under its field and keeps what was typed', async () => {
  api.signUp.mockRejectedValue(
    apiError('invalid', 'That username is already taken.', { field: 'username', code: 'username_taken' }),
  )
  render(<App />)
  switchToSignUp()

  fillAndSend('alice', 'a good password', 'Create account')

  await waitFor(() => expect(screen.getByText('That username is already taken.')).toBeTruthy())
  expect(screen.getByText('That username is already taken.').id).toBe('login-username-error')
  expect(usernameField().value).toBe('alice')
  expect(passwordField().value).toBe('a good password')
})

// --- Can't reach the server ------------------------------------------------------

test('if the server can\'t be reached, the message and banner show, and Try again resends the form', async () => {
  api.logIn.mockRejectedValueOnce(unreachable()).mockResolvedValueOnce(session('alice'))
  render(<App />)

  fillAndSend('alice', 'a good password')

  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(UNREACHABLE_MESSAGE))
  expect(loginBox().getByText(UNREACHABLE_MESSAGE)).toBeTruthy()

  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))

  await dashboardLoaded()
  expect(api.logIn).toHaveBeenCalledTimes(2)
  expect(api.logIn).toHaveBeenLastCalledWith('alice', 'a good password')
})

test('the waking note shows if the first log in is slow, then goes', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-10-14T06:00:00Z'))
  let finish
  api.logIn.mockImplementation(() => new Promise((resolve) => (finish = () => resolve(session('alice')))))
  render(<App />)
  const note = () => screen.getByRole('status', { name: 'Server status' })

  fillAndSend('alice', 'a good password')
  await act(() => vi.advanceTimersByTimeAsync(4999))
  expect(note().textContent).toBe('')
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(note().textContent).toBe('Waking up the server, this can take up to a minute...')

  await act(async () => finish())
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByRole('status', { name: 'Server status' }).textContent).toBe('')
})

// --- Opening the page with a saved token (staying logged in after a reload) ---

test('with a saved token, the page checks it and opens the dashboard', async () => {
  api.savedToken.mockReturnValue('token')
  let finish
  api.whoAmI.mockImplementation(() => new Promise((resolve) => (finish = () => resolve({ username: 'alice' }))))
  render(<App />)

  expect(screen.getByText('Loading...')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Log in' })).toBeNull()
  await act(async () => finish())

  await dashboardLoaded()
  expect(screen.getByText(/^Hi alice, here's your spending/)).toBeTruthy()
  expect(api.logIn).not.toHaveBeenCalled()
})

test('a saved token whose session has expired shows the log in screen with the message', async () => {
  api.savedToken.mockReturnValue('token')
  api.whoAmI.mockRejectedValue(apiError('unauthorized', EXPIRED_MESSAGE, { code: 'session_expired' }))
  render(<App />)

  await waitFor(() => expect(loginBox().getByText(EXPIRED_MESSAGE)).toBeTruthy())
  expect(loginBox().getByText(EXPIRED_MESSAGE).className).toContain('form-error')
  expect(api.getSummary).not.toHaveBeenCalled()
})

test('a saved token that is simply unknown shows the log in screen without a message', async () => {
  api.savedToken.mockReturnValue('token')
  api.whoAmI.mockRejectedValue(apiError('unauthorized', 'Please log in to continue.', { code: 'not_logged_in' }))
  render(<App />)

  await waitFor(() => expect(loginBox().getByRole('heading', { name: 'Log in' })).toBeTruthy())
  expect(screen.queryByText('Please log in to continue.')).toBeNull()
})

test('if the server can\'t be reached while checking, Try again checks again', async () => {
  api.savedToken.mockReturnValue('token')
  api.whoAmI.mockRejectedValueOnce(unreachable()).mockResolvedValueOnce({ username: 'alice' })
  render(<App />)

  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(UNREACHABLE_MESSAGE))
  expect(loginBox().getByRole('heading', { name: 'Log in' })).toBeTruthy()

  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))

  await dashboardLoaded()
  expect(api.whoAmI).toHaveBeenCalledTimes(2)
})

// --- Logging out ------------------------------------------------------------------

async function openDashboardAs(username) {
  api.savedToken.mockReturnValue('token')
  api.whoAmI.mockResolvedValue({ username })
  render(<App />)
  await dashboardLoaded()
}

test('Log out sits just left of + Add expense, in the title row', async () => {
  await openDashboardAs('alice')

  const titleRow = document.querySelector('header.page-title')
  const buttons = within(titleRow).getAllByRole('button').map((button) => button.textContent)
  expect(buttons).toEqual(['Log out', '+ Add expense'])
  expect(within(titleRow).getByRole('button', { name: 'Log out' }).className).toContain('secondary')
})

test('logging out ends the session and shows the log in screen, with nothing left from the dashboard', async () => {
  await openDashboardAs('alice')

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

  await waitFor(() => expect(loginBox().getByRole('heading', { name: 'Log in' })).toBeTruthy())
  expect(api.logOut).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Lunch')).toBeNull()
  expect(screen.queryByText(/^Hi alice/)).toBeNull()
  expect(screen.getByText(SUBTITLE)).toBeTruthy()
  expect(usernameField().value).toBe('')
})

// --- When a session ends while using the page ----------------------------------

test('a 401 from any request shows the log in screen with the backend\'s message', async () => {
  await openDashboardAs('alice')

  act(() => endSession(EXPIRED_MESSAGE))

  await waitFor(() => expect(loginBox().getByText(EXPIRED_MESSAGE)).toBeTruthy())
  expect(screen.queryByText('Lunch')).toBeNull()
  expect(screen.queryByRole('button', { name: '+ Add expense' })).toBeNull()
})

test('a session that ends while a popup is open closes the popup', async () => {
  await openDashboardAs('alice')
  api.addExpense.mockImplementation(async () => {
    endSession(EXPIRED_MESSAGE)
    throw apiError('unauthorized', EXPIRED_MESSAGE, { code: 'session_expired' })
  })
  fireEvent.click(screen.getByRole('button', { name: '+ Add expense' }))
  const popup = within(screen.getByRole('dialog', { name: 'Add expense' }))
  type(popup.getByLabelText('Amount (Rs)'), '4.00')
  fireEvent.change(popup.getByLabelText('Category'), { target: { value: 'Food' } })
  fireEvent.click(popup.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(loginBox().getByText(EXPIRED_MESSAGE)).toBeTruthy())
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the page listens for ended sessions from the start', () => {
  render(<App />)
  expect(api.onSessionEnded).toHaveBeenCalled()
})
