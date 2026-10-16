// @vitest-environment jsdom
// The login token in api.js (specs/frontend-spec.md, "Logging in";
// specs/api-contract-spec.md, "Logging in (sessions)"). fetch is faked, so
// no server is used.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const SESSION = { username: 'alice', token: 'token-123', expires_at: '2026-10-21T06:00:00Z' }
const EXPIRED = {
  error: { code: 'session_expired', message: 'Your session has expired. Please log in again.', field: null },
}
const WRONG = { error: { code: 'wrong_login', message: 'Username or password is incorrect.', field: null } }

let fetch

function answer(status, body) {
  fetch.mockImplementation(async () =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status }),
  )
}

async function freshApi() {
  vi.resetModules()
  return import('./api.js')
}

beforeEach(() => {
  localStorage.clear()
  fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const sentHeaders = (call = 0) => fetch.mock.calls[call][1].headers ?? {}

test('logging in saves the token, and every later request sends it', async () => {
  const api = await freshApi()
  answer(200, SESSION)

  expect(await api.logIn('Alice', 'a good password')).toEqual(SESSION)
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ username: 'Alice', password: 'a good password' })
  expect(api.savedToken()).toBe('token-123')

  answer(200, [])
  await api.listExpenses()
  expect(sentHeaders(1).Authorization).toBe('Bearer token-123')
})

test('signing up saves the token too', async () => {
  const api = await freshApi()
  answer(201, SESSION)

  await api.signUp('alice', 'a good password')

  expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/auth/signup')
  expect(api.savedToken()).toBe('token-123')
})

test('the token survives reloading the page', async () => {
  answer(200, SESSION)
  await (await freshApi()).logIn('alice', 'a good password')

  // A fresh copy of api.js is like reopening the page.
  const reopened = await freshApi()
  expect(reopened.savedToken()).toBe('token-123')
  answer(200, { username: 'alice' })
  expect(await reopened.whoAmI()).toEqual({ username: 'alice' })
  expect(sentHeaders(1).Authorization).toBe('Bearer token-123')
})

test('without a token, no Authorization header is sent', async () => {
  const api = await freshApi()
  answer(200, [])
  await api.listExpenses()
  expect(sentHeaders().Authorization).toBeUndefined()
})

test('a 401 on a data request forgets the token and tells the page', async () => {
  localStorage.setItem('expense-tracker-token', 'old-token')
  const api = await freshApi()
  const ended = vi.fn()
  api.onSessionEnded(ended)
  answer(401, EXPIRED)

  await expect(api.getSummary()).rejects.toMatchObject({ kind: 'unauthorized', code: 'session_expired' })

  expect(ended).toHaveBeenCalledWith('Your session has expired. Please log in again.')
  expect(api.savedToken()).toBeNull()
})

test('a wrong log in is an error for the form, not an ended session', async () => {
  const api = await freshApi()
  const ended = vi.fn()
  api.onSessionEnded(ended)
  answer(401, WRONG)

  await expect(api.logIn('alice', 'nope nope')).rejects.toMatchObject({
    kind: 'unauthorized',
    code: 'wrong_login',
    message: 'Username or password is incorrect.',
  })
  expect(ended).not.toHaveBeenCalled()
})

test('checking a saved token reports a 401 to the caller only', async () => {
  localStorage.setItem('expense-tracker-token', 'old-token')
  const api = await freshApi()
  const ended = vi.fn()
  api.onSessionEnded(ended)
  answer(401, EXPIRED)

  await expect(api.whoAmI()).rejects.toMatchObject({ kind: 'unauthorized', code: 'session_expired' })
  expect(ended).not.toHaveBeenCalled()
  // The token is no good, so it is removed.
  expect(api.savedToken()).toBeNull()
})

test('logging out tells the backend, then forgets the token', async () => {
  localStorage.setItem('expense-tracker-token', 'token-123')
  const api = await freshApi()
  answer(204)

  await api.logOut()

  expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/auth/logout')
  expect(fetch.mock.calls[0][1].method).toBe('POST')
  expect(sentHeaders().Authorization).toBe('Bearer token-123')
  expect(api.savedToken()).toBeNull()
})

test('logging out forgets the token even if the server can\'t be reached', async () => {
  localStorage.setItem('expense-tracker-token', 'token-123')
  const api = await freshApi()
  fetch.mockRejectedValue(new TypeError('Failed to fetch'))

  await api.logOut()

  expect(api.savedToken()).toBeNull()
})

test('a browser that blocks storage still works, just without remembering', async () => {
  const api = await freshApi()
  const blocked = () => {
    throw new Error('storage blocked')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  answer(200, SESSION)

  await expect(api.logIn('alice', 'a good password')).resolves.toEqual(SESSION)
  expect(api.savedToken()).toBeNull()
  // Still logged in for as long as the page stays open.
  answer(200, [])
  await api.listExpenses()
  expect(sentHeaders(1).Authorization).toBe('Bearer token-123')
  vi.restoreAllMocks()
})
