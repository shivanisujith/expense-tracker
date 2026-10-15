// The backend's address is a build setting, and the page waits up to 90
// seconds for an answer (specs/frontend-spec.md, "Where the page runs";
// specs/api-contract-spec.md, "When the backend can't be reached").
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function addressUsed() {
  const fetch = vi.fn(async () => new Response('[]', { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  const api = await import('./api.js')
  await api.listExpenses()
  return fetch.mock.calls[0][0]
}

test('without the build setting, the laptop backend is used', async () => {
  vi.stubEnv('VITE_API_BASE', undefined)
  expect(await addressUsed()).toBe('http://localhost:8000/api/expenses')
})

test('an empty build setting also falls back to the laptop backend', async () => {
  vi.stubEnv('VITE_API_BASE', '')
  expect(await addressUsed()).toBe('http://localhost:8000/api/expenses')
})

test('the build setting chooses the online backend', async () => {
  vi.stubEnv('VITE_API_BASE', 'https://expense-tracker-api.onrender.com/api')
  expect(await addressUsed()).toBe('https://expense-tracker-api.onrender.com/api/expenses')
})

test('every request waits up to 90 seconds before "can\'t reach the server"', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  await addressUsed()
  expect(timeout).toHaveBeenCalledWith(90_000)
})
