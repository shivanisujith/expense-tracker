import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { onSessionEnded, logOut, savedToken, whoAmI } from './api.js'
import Dashboard from './Dashboard.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import PageTitle from './components/PageTitle.jsx'
import { formatFullDate } from './dates.js'

// The free online backend sleeps and takes about a minute to wake, so the
// first slow wait gets a calm note (specs/frontend-spec.md, "Page title").
const WAKING_NOTE_DELAY_MS = 5000

/**
 * The waking note for the log in screen: it follows only the first request
 * to the server since the page opened (the saved token's check, or else the
 * first Log in / Create account), and never shows again after that.
 */
function useFirstWaitNote() {
  const [waking, setWaking] = useState(false)
  const tracked = useRef(false)
  const trackFirstWait = useCallback((promise) => {
    if (tracked.current) return promise
    tracked.current = true
    const timer = setTimeout(() => setWaking(true), WAKING_NOTE_DELAY_MS)
    return promise.finally(() => {
      clearTimeout(timer)
      setWaking(false)
    })
  }, [])
  return { waking, trackFirstWait }
}

/**
 * Chooses the screen (specs/frontend-spec.md, "Logging in"):
 *   'checking'  - a saved token is being checked ("Loading...")
 *   'login'     - the log in screen, with an optional message at the top
 *   'dashboard' - the logged-in account's dashboard
 */
function App() {
  const [view, setView] = useState(() =>
    savedToken() ? { screen: 'checking' } : { screen: 'login', message: null },
  )
  // The saved token couldn't be checked because the server couldn't be reached.
  const [checkFailed, setCheckFailed] = useState(false)
  // A new number shows a fresh log in screen (empty form) each time.
  const [loginKey, setLoginKey] = useState(0)
  const { waking, trackFirstWait } = useFirstWaitNote()

  const showLogin = useCallback((message = null) => {
    setLoginKey((key) => key + 1)
    setView({ screen: 'login', message })
  }, [])

  // Any request that answers 401 while the dashboard is open ends up here.
  useEffect(() => onSessionEnded((message) => showLogin(message)), [showLogin])

  const checkSavedToken = useCallback(async () => {
    try {
      const { username } = await trackFirstWait(whoAmI())
      setCheckFailed(false)
      setView({ screen: 'dashboard', username })
    } catch (error) {
      if (error.kind === 'unauthorized') {
        // The token is already forgotten. Only an expired session explains itself.
        setCheckFailed(false)
        showLogin(error.code === 'session_expired' ? error.message : null)
      } else if (error.kind === 'unreachable') {
        setCheckFailed(true)
        setView((current) => (current.screen === 'checking' ? { screen: 'login', message: null } : current))
      } else {
        setView({ screen: 'login', message: 'Something went wrong on the server. Please try again.' })
      }
    }
  }, [trackFirstWait, showLogin])

  // A saved token is checked once, when the page opens.
  const tokenToCheck = useRef(view.screen === 'checking')
  useEffect(() => {
    if (!tokenToCheck.current) return
    tokenToCheck.current = false
    checkSavedToken()
  }, [checkSavedToken])

  async function handleLogOut() {
    await logOut()
    setCheckFailed(false)
    showLogin()
  }

  if (view.screen === 'dashboard') {
    return <Dashboard username={view.username} onLogOut={handleLogOut} />
  }

  const subtitle = view.screen === 'checking' ? 'Loading...' : `Log in to see your spending · ${formatFullDate()}`
  return (
    <>
      <PageTitle subtitle={subtitle} waking={waking} />
      {view.screen === 'login' && (
        <LoginScreen
          key={loginKey}
          message={view.message}
          checkFailed={checkFailed}
          onRetryCheck={checkSavedToken}
          onLoggedIn={(username) => {
            setCheckFailed(false)
            setView({ screen: 'dashboard', username })
          }}
          trackFirstWait={trackFirstWait}
        />
      )}
    </>
  )
}

export default App
