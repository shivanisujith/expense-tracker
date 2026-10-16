// The log in screen's checks before sending (specs/frontend-spec.md,
// "Logging in"). Creating an account uses the backend's own rules and
// messages (specs/backend-spec.md, rules A1, A3, A4); logging in only needs
// both fields filled in. The backend checks everything again.

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 64

/**
 * `mode` is 'login' or 'signup'. Returns { username?, password? }: the
 * message for each field that fails, so an empty object means "send it".
 */
export function checkLoginForm({ username, password }, mode) {
  const errors = {}
  // Spaces around the username are removed; the password is used exactly as typed.
  const name = username.trim()

  if (name === '') errors.username = 'Please enter a username.'
  else if (mode === 'signup' && !USERNAME_PATTERN.test(name)) {
    errors.username = 'Username must be 3 to 20 characters, using only letters, numbers and underscores.'
  }

  // Counted in characters, like the backend: an emoji is one, not two.
  const length = [...password].length
  if (password === '') errors.password = 'Please enter a password.'
  else if (mode === 'signup') {
    if (length < PASSWORD_MIN_LENGTH) errors.password = 'Password must be at least 8 characters.'
    else if (length > PASSWORD_MAX_LENGTH) errors.password = 'Password must be 64 characters or fewer.'
    else if (password.toLowerCase() === name.toLowerCase()) {
      errors.password = "Password can't be the same as your username."
    }
  }
  return errors
}
