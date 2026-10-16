// The log in screen's own checks before sending (specs/frontend-spec.md,
// "Logging in" > "Frontend checks before sending"). The backend checks
// everything again.
import { expect, test } from 'vitest'
import { checkLoginForm } from './loginForm.js'

const USERNAME_RULE = 'Username must be 3 to 20 characters, using only letters, numbers and underscores.'

test('logging in only needs both fields filled in', () => {
  expect(checkLoginForm({ username: '', password: '' }, 'login')).toEqual({
    username: 'Please enter a username.',
    password: 'Please enter a password.',
  })
  expect(checkLoginForm({ username: '   ', password: 'x' }, 'login')).toEqual({
    username: 'Please enter a username.',
  })
  // The sign-up rules don't apply: the backend just says the details are wrong.
  expect(checkLoginForm({ username: 'ab', password: 'short' }, 'login')).toEqual({})
})

test('creating an account checks the username rule', () => {
  for (const username of ['ab', 'a'.repeat(21), 'has space', 'dash-name', 'émile', 'name!']) {
    expect(checkLoginForm({ username, password: 'a good password' }, 'signup')).toEqual({
      username: USERNAME_RULE,
    })
  }
  for (const username of ['abc', 'a'.repeat(20), 'A_1', '  Bob_7  ']) {
    expect(checkLoginForm({ username, password: 'a good password' }, 'signup')).toEqual({})
  }
})

test('creating an account checks the password rules, in order', () => {
  const check = (password, username = 'tester') => checkLoginForm({ username, password }, 'signup')
  expect(check('')).toEqual({ password: 'Please enter a password.' })
  expect(check('x'.repeat(7))).toEqual({ password: 'Password must be at least 8 characters.' })
  expect(check('x'.repeat(65))).toEqual({ password: 'Password must be 64 characters or fewer.' })
  expect(check('x'.repeat(8))).toEqual({})
  expect(check('y'.repeat(64))).toEqual({})
  // Each emoji counts as one character, as on the backend.
  expect(check('🙂'.repeat(8))).toEqual({})
  expect(check('🙂'.repeat(33))).toEqual({})
  expect(check('TESTER99', 'tester99')).toEqual({ password: "Password can't be the same as your username." })
  // Spaces around the username don't count; spaces in the password do.
  expect(check('tester99', '  Tester99 ')).toEqual({ password: "Password can't be the same as your username." })
  expect(check(' tester99', 'tester99')).toEqual({})
})

test('both fields can show a message at once', () => {
  expect(checkLoginForm({ username: '', password: 'short' }, 'signup')).toEqual({
    username: 'Please enter a username.',
    password: 'Password must be at least 8 characters.',
  })
})
