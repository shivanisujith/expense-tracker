import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { listExpenses } from './api.js'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ServerBanner from './components/ServerBanner.jsx'

function App() {
  // null until the first successful load; kept on screen during reloads.
  const [expenses, setExpenses] = useState(null)
  const [listStatus, setListStatus] = useState('loading')
  const [unreachable, setUnreachable] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const loaded = await listExpenses()
      setExpenses(loaded)
      setListStatus('loaded')
      setUnreachable(false)
    } catch (error) {
      if (error.kind === 'unreachable') {
        setListStatus('unreachable')
        setUnreachable(true)
      } else {
        setListStatus('error')
        setUnreachable(false)
      }
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function retry() {
    setRetrying(true)
    await loadAll()
    setRetrying(false)
  }

  return (
    <main className="app">
      <h1>Expense Tracker</h1>
      {unreachable && <ServerBanner onRetry={retry} retrying={retrying} />}
      <ExpenseForm onSaved={loadAll} onUnreachable={() => setUnreachable(true)} />
      <ExpenseList expenses={expenses} status={listStatus} onRetry={loadAll} />
    </main>
  )
}

export default App
