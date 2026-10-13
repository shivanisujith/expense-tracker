import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { getSummary, listExpenses } from './api.js'
import CategoryCards from './components/CategoryCards.jsx'
import EditExpenseModal from './components/EditExpenseModal.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ManageCategoriesModal from './components/ManageCategoriesModal.jsx'
import ServerBanner from './components/ServerBanner.jsx'
import Toast from './components/Toast.jsx'
import { formatFullDate } from './dates.js'
import { useToast } from './toast.js'

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
  const [managingCategories, setManagingCategories] = useState(false)
  const { toast, showToast, clearToast } = useToast()

  // The current categories, in order, come from the summary.
  const categories = summary
    ? summary.categories.map((row) => ({ id: row.category_id, name: row.category }))
    : []

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

  // Each successful change shows a toast, then reloads the page data.
  function succeeded(message) {
    showToast(message)
    loadAll()
  }

  function handleEditSaved() {
    setEditing(null)
    succeeded('Expense updated')
  }

  function closeManageCategories() {
    clearToast()
    setManagingCategories(false)
  }

  return (
    <>
      <header className="page-title">
        <h1>Expense Tracker</h1>
        <p className="page-subtitle">{`Hi there, here's your spending · ${formatFullDate()}`}</p>
      </header>
      <main className="app">
        {unreachable && <ServerBanner onRetry={retry} retrying={retrying} />}
        <ExpenseForm
          categories={categories}
          onSaved={() => succeeded('Expense added')}
          onUnreachable={showUnreachable}
        />
        <div className="dashboard-columns">
          <CategoryCards
            summary={summary}
            status={summaryStatus}
            onRetry={loadAll}
            onLimitSaved={() => succeeded('Limit saved')}
            onManage={() => setManagingCategories(true)}
            onUnreachable={showUnreachable}
          />
          <ExpenseList
            expenses={expenses}
            status={listStatus}
            onRetry={loadAll}
            onEdit={setEditing}
            onDeleted={() => succeeded('Expense deleted')}
            onReload={loadAll}
            onUnreachable={showUnreachable}
          />
        </div>
      </main>
      {editing && (
        <EditExpenseModal
          key={editing.id}
          expense={editing}
          categories={categories}
          onSaved={handleEditSaved}
          onClose={() => setEditing(null)}
          onNotFound={loadAll}
          onUnreachable={showUnreachable}
        />
      )}
      {/* While the categories popup is open, its own copy shows the toast. */}
      <Toast toast={managingCategories ? null : toast} />
      {managingCategories && (
        <ManageCategoriesModal
          categories={categories}
          toast={toast}
          onSuccess={showToast}
          onChanged={loadAll}
          onClose={closeManageCategories}
          onUnreachable={showUnreachable}
        />
      )}
    </>
  )
}

export default App
