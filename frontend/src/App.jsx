import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { getSummary, listExpenses } from './api.js'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ServerBanner from './components/ServerBanner.jsx'
import SummaryTable from './components/SummaryTable.jsx'

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

  // The expense being edited (null = add mode), and a message for the form
  // that must survive the form switching back to add mode.
  const [editing, setEditing] = useState(null)
  const [formNotice, setFormNotice] = useState('')

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

  function startEditing(expense) {
    setFormNotice('')
    setEditing(expense)
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  function stopEditing() {
    setFormNotice('')
    setEditing(null)
  }

  function handleFormSaved() {
    stopEditing()
    loadAll()
  }

  function handleEditNotFound(message) {
    setEditing(null)
    setFormNotice(message)
    loadAll()
  }

  function handleDeleted(id) {
    if (editing?.id === id) stopEditing()
    loadAll()
  }

  return (
    <main className="app">
      <h1>Expense Tracker</h1>
      {unreachable && <ServerBanner onRetry={retry} retrying={retrying} />}
      <ExpenseForm
        key={editing ? `edit-${editing.id}` : 'add'}
        editing={editing}
        initialError={formNotice}
        onSaved={handleFormSaved}
        onNotFound={handleEditNotFound}
        onCancel={stopEditing}
        onUnreachable={showUnreachable}
      />
      <SummaryTable
        summary={summary}
        status={summaryStatus}
        onRetry={loadAll}
        onLimitSaved={loadAll}
        onUnreachable={showUnreachable}
      />
      <ExpenseList
        expenses={expenses}
        status={listStatus}
        editingId={editing?.id ?? null}
        onRetry={loadAll}
        onEdit={startEditing}
        onDeleted={handleDeleted}
        onUnreachable={showUnreachable}
      />
    </main>
  )
}

export default App
