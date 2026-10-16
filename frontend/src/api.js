// Every call to the backend goes through request(), which turns any failure
// into an ApiError with one of five kinds (see specs/api-contract-spec.md):
//   'unreachable'  - no response at all, or none within 90 seconds
//   'invalid'      - 422, the backend refused the input
//   'unauthorized' - 401, not logged in, session ended, or a wrong log in
//   'not_found'    - 404, the expense or category no longer exists
//   'server'       - 500 or anything else unexpected
//
// It also sends the login token with every request (specs/frontend-spec.md,
// "Logging in").

// The backend's address is a build setting: GitHub Actions sets
// VITE_API_BASE to the Render address for the online build. Without it
// (npm run dev, tests), the laptop backend is used.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'
// Long enough for the free online backend to wake up (about a minute).
const TIMEOUT_MS = 90_000

const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Please try again.'

export class ApiError extends Error {
  constructor(kind, message, field = null, code = null) {
    super(message)
    this.kind = kind
    this.field = field
    this.code = code
  }
}

// The token is kept in localStorage so a reload stays logged in. Some
// browsers block storage (for example private windows), so every use is
// wrapped, and the token is also kept here for as long as the page is open.
const TOKEN_KEY = 'expense-tracker-token'
let token = null

/** The token saved by an earlier visit, or null. */
export function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function keepToken(newToken) {
  token = newToken
  try {
    localStorage.setItem(TOKEN_KEY, newToken)
  } catch {
    // Not remembered after a reload, but this page still works.
  }
}

function forgetToken() {
  token = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing was saved.
  }
}

// The page's handler for a session that ends while it is being used.
let sessionEnded = null

/** `handler(message)` runs whenever a data request answers 401. */
export function onSessionEnded(handler) {
  sessionEnded = handler
  return () => {
    if (sessionEnded === handler) sessionEnded = null
  }
}

// `ownErrors`: the log in, sign up and "who is logged in" calls handle their
// own 401s, so those don't count as a session ending while using the page.
async function request(method, path, body, { ownErrors = false } = {}) {
  const options = { method, signal: AbortSignal.timeout(TIMEOUT_MS), headers: {} }
  const currentToken = token ?? savedToken()
  if (currentToken) options.headers.Authorization = `Bearer ${currentToken}`
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  let data = null
  try {
    response = await fetch(API_BASE + path, options)
    if (response.status !== 204) {
      data = await response.json().catch(() => null)
    }
  } catch {
    throw new ApiError('unreachable', "Can't reach the server.")
  }

  if (response.status === 204) return null
  if (response.ok && data !== null) return data

  const error = data?.error
  if (response.status === 422 && error) {
    throw new ApiError('invalid', error.message, error.field)
  }
  if (response.status === 404 && error) {
    throw new ApiError('not_found', error.message)
  }
  if (response.status === 401 && error) {
    // Whatever token was sent no longer works.
    forgetToken()
    if (!ownErrors) sessionEnded?.(error.message)
    throw new ApiError('unauthorized', error.message, null, error.code)
  }
  throw new ApiError('server', error?.message ?? SERVER_ERROR_MESSAGE)
}

/** Creates the account and logs in; the token is kept for later requests. */
export async function signUp(username, password) {
  const session = await request('POST', '/auth/signup', { username, password }, { ownErrors: true })
  keepToken(session.token)
  return session
}

/** Logs in; the token is kept for later requests. */
export async function logIn(username, password) {
  const session = await request('POST', '/auth/login', { username, password }, { ownErrors: true })
  keepToken(session.token)
  return session
}

/** Ends the session, then forgets the token whatever the answer. */
export async function logOut() {
  try {
    await request('POST', '/auth/logout', undefined, { ownErrors: true })
  } catch {
    // Logged out on this page either way.
  } finally {
    forgetToken()
  }
}

/** Who the saved token belongs to: { username }. */
export const whoAmI = () => request('GET', '/auth/me', undefined, { ownErrors: true })

/** All expenses, or only those dated in `month` (YYYY-MM) when one is given. */
export const listExpenses = (month = null) =>
  request('GET', month === null ? '/expenses' : `/expenses?month=${encodeURIComponent(month)}`)
export const addExpense = (expense) => request('POST', '/expenses', expense)
export const editExpense = (id, expense) => request('PUT', `/expenses/${id}`, expense)
export const deleteExpense = (id) => request('DELETE', `/expenses/${id}`)
export const getSummary = () => request('GET', '/summary')
export const getMonths = () => request('GET', '/months')
export const getMonthTotal = (month) => request('GET', `/months/${encodeURIComponent(month)}/total`)
export const setLimit = (categoryId, limitPaise) =>
  request('PUT', `/categories/${categoryId}/limit`, { limit_paise: limitPaise })
export const addCategory = (name) => request('POST', '/categories', { name })
export const renameCategory = (id, name) => request('PUT', `/categories/${id}`, { name })
export const deleteCategory = (id) => request('DELETE', `/categories/${id}`)
