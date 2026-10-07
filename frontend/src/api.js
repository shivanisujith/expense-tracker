// Every call to the backend goes through request(), which turns any failure
// into an ApiError with one of four kinds (see specs/api-contract-spec.md):
//   'unreachable' - no response at all, or none within 10 seconds
//   'invalid'     - 422, the backend refused the input
//   'not_found'   - 404, the expense no longer exists
//   'server'      - 500 or anything else unexpected

const API_BASE = 'http://localhost:8000/api'
const TIMEOUT_MS = 10_000

const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Please try again.'

export class ApiError extends Error {
  constructor(kind, message, field = null) {
    super(message)
    this.kind = kind
    this.field = field
  }
}

async function request(method, path, body) {
  const options = { method, signal: AbortSignal.timeout(TIMEOUT_MS) }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
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
  throw new ApiError('server', error?.message ?? SERVER_ERROR_MESSAGE)
}

export const listExpenses = () => request('GET', '/expenses')
export const addExpense = (expense) => request('POST', '/expenses', expense)
export const editExpense = (id, expense) => request('PUT', `/expenses/${id}`, expense)
export const deleteExpense = (id) => request('DELETE', `/expenses/${id}`)
export const getSummary = () => request('GET', '/summary')
export const setLimit = (category, limitPaise) =>
  request('PUT', `/limits/${encodeURIComponent(category)}`, { limit_paise: limitPaise })
