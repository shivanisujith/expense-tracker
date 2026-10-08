import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { getSummary, listExpenses } from './api.js'
import CategoryCards from './components/CategoryCards.jsx'
import EditExpenseModal from './components/EditExpenseModal.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ServerBanner from './components/ServerBanner.jsx'
import { formatMonth } from './dates.js'

function statusFor(result) {
  if (result.status === 'fulfilled') return 'loaded'
  return result.reason.kind === 'unreachable' ? 'unreachable' : 'error'
}

function App() {
  // Data is null until the first successful load, and kept on screen during reloads.
  const [expenses, setExpenses] = useState(null)
  const [summary, setSummary] = useState(null)
  const [listStatus, setListStatus] = useState('loading')
  const [summaryStatus, setSummaryStatus] = useState('loading')
  const [unreachable, setUnreachable] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // The expense open in the edit popup, or null when the popup is closed.
  const [editing, setEditing] = useState(null)

  // The frontend never works out totals itself: after every change it
  // reloads both the list and the summary from the backend.
  const loadAll = useCallback(async () => {
    const [listResult, summaryResult] = await Promise.allSettled([listExpenses(), getSummary()])
    if (listResult.status === 'fulfilled') setExpenses(listResult.value)
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
    setListStatus(statusFor(listResult))
    setSummaryStatus(statusFor(summaryResult))
    setUnreachable([listResult, summaryResult].some((r) => statusFor(r) === 'unreachable'))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function retry() {
    setRetrying(true)
    await loadAll()
    setRetrying(false)
  }

  function showUnreachable() {
    setUnreachable(true)
  }

  function handleEditSaved() {
    setEditing(null)
    loadAll()
  }

  return (
    <>
      <header className="header-bar">
        <div className="header-inner">
          <h1>Expense Tracker</h1>
          {summary && <p className="header-month">{formatMonth(summary.month)}</p>}
        </div>
      </header>
      <main className="app">
        {unreachable && <ServerBanner onRetry={retry} retrying={retrying} />}
        <CategoryCards
          summary={summary}
          status={summaryStatus}
          onRetry={loadAll}
          onLimitSaved={loadAll}
          onUnreachable={showUnreachable}
        />
        <ExpenseForm onSaved={loadAll} onUnreachable={showUnreachable} />
        <ExpenseList
          expenses={expenses}
          status={listStatus}
          onRetry={loadAll}
          onEdit={setEditing}
          onDeleted={loadAll}
          onUnreachable={showUnreachable}
        />
      </main>
      {editing && (
        <EditExpenseModal
          key={editing.id}
          expense={editing}
          onSaved={handleEditSaved}
          onClose={() => setEditing(null)}
          onNotFound={loadAll}
          onUnreachable={showUnreachable}
        />
      )}
    </>
  )
}

export default App
