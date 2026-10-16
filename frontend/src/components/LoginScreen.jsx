import { useState } from 'react'
import { logIn, signUp } from '../api.js'
import { checkLoginForm } from '../loginForm.js'
import ModalField from './ModalField.jsx'
import ServerBanner from './ServerBanner.jsx'

const UNREACHABLE_MESSAGE = "Can't reach the server. Check that the backend is running, then try again."
const SERVER_ERROR_MESSAGE = 'Something went wrong on the server. Please try again.'

const WORDING = {
  login: {
    heading: 'Log in',
    button: 'Log in',
    sending: 'Logging in...',
    switchTo: 'New here? Create an account',
    passwordAutocomplete: 'current-password',
  },
  signup: {
    heading: 'Create an account',
    button: 'Create account',
    sending: 'Creating account...',
    switchTo: 'Already have an account? Log in',
    passwordAutocomplete: 'new-password',
  },
}

/**
 * The log in screen's box (specs/frontend-spec.md, "Logging in"), below the
 * page title. `message` is shown at the top when the page was sent here, for
 * example after a session expired. `checkFailed` means a saved token
 * couldn't be checked because the server couldn't be reached; the banner's
 * Try again then checks it again (`onRetryCheck`). After this form's own
 * attempt couldn't reach the server, Try again sends the form again.
 * `trackFirstWait` lets the waking note follow the first slow request.
 */
function LoginScreen({ message, checkFailed, onRetryCheck, onLoggedIn, trackFirstWait }) {
  const [mode, setMode] = useState('login')
  const [values, setValues] = useState({ username: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [topMessage, setTopMessage] = useState(message ?? '')
  const [sending, setSending] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const words = WORDING[mode]

  function update(field) {
    return (event) => setValues({ ...values, [field]: event.target.value })
  }

  // Links an input to its message under it, for screen readers.
  function errorProps(field) {
    const error = fieldErrors[field]
    return {
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `login-${field}-error` : undefined,
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setFieldErrors({})
    setTopMessage('')
  }

  async function send() {
    setTopMessage('')
    const errors = checkLoginForm(values, mode)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSending(true)
    try {
      const call = mode === 'login' ? logIn : signUp
      const session = await trackFirstWait(call(values.username, values.password))
      onLoggedIn(session.username)
    } catch (error) {
      setSending(false)
      setUnreachable(error.kind === 'unreachable')
      if (error.kind === 'unreachable') {
        setTopMessage(UNREACHABLE_MESSAGE)
      } else if (error.kind === 'unauthorized') {
        // A wrong log in: start the password again, keep the username.
        setTopMessage(error.message)
        setValues((current) => ({ ...current, password: '' }))
      } else if (error.kind === 'invalid' && (error.field === 'username' || error.field === 'password')) {
        setFieldErrors({ [error.field]: error.message })
      } else if (error.kind === 'invalid') {
        setTopMessage(error.message)
      } else {
        setTopMessage(SERVER_ERROR_MESSAGE)
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!sending) send()
  }

  async function retry() {
    setRetrying(true)
    await (unreachable ? send() : onRetryCheck())
    setRetrying(false)
  }

  return (
    <main className="app login-page">
      {(unreachable || checkFailed) && <ServerBanner onRetry={retry} retrying={retrying || sending} />}
      <section className="card login-box" aria-labelledby="login-heading">
        <h2 id="login-heading">{words.heading}</h2>
        {topMessage && <p className="form-error login-message">{topMessage}</p>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-fields">
            <ModalField label="Username" id="login-username" error={fieldErrors.username}>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                // The first thing to fill in when the screen opens.
                autoFocus
                value={values.username}
                onChange={update('username')}
                {...errorProps('username')}
              />
            </ModalField>
            <ModalField label="Password" id="login-password" error={fieldErrors.password}>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete={words.passwordAutocomplete}
                value={values.password}
                onChange={update('password')}
                {...errorProps('password')}
              />
            </ModalField>
          </div>
          <button type="submit" className="login-submit" disabled={sending}>
            {sending ? words.sending : words.button}
          </button>
        </form>
        <button type="button" className="link-button" onClick={switchMode} disabled={sending}>
          {words.switchTo}
        </button>
      </section>
    </main>
  )
}

export default LoginScreen
