import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { getSummary, listExpenses } from './api.js'
import CategoryCards from './components/CategoryCards.jsx'
import EditExpenseModal from './components/EditExpenseModal.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ManageCategoriesModal from './components/ManageCategoriesModal.jsx'
import ServerBanner from './components/ServerBanner.jsx'
import SpentThisMonth from './components/SpentThisMonth.jsx'
import { formatFullDate } from './dates.js'
import { useSuccessMessage } from './successMessage.js'

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
  const { success, showSuccess, clearSuccess } = useSuccessMessage()

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

  // Each successful change shows a success message in its own box, then
  // reloads the page data.
  function succeeded(message, place) {
    showSuccess(message, place)
    loadAll()
  }

  // The success message for one box, or null if it belongs elsewhere.
  function successFor(place) {
    return success?.place === place ? success : null
  }

  function handleEditSaved() {
    setEditing(null)
    succeeded('Expense updated', 'expenses')
  }

  function closeManageCategories() {
    if (success?.place === 'categories') clearSuccess()
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
        <SpentThisMonth summary={summary} status={summaryStatus} />
        <ExpenseForm
          categories={categories}
          success={successFor('add-form')}
          onSaved={() => succeeded('Expense added', 'add-form')}
          onUnreachable={showUnreachable}
        />
        <div className="dashboard-columns">
          <CategoryCards
            summary={summary}
            status={summaryStatus}
            onRetry={loadAll}
            success={success}
            onLimitSaved={(categoryId) => succeeded('Limit saved', `card-${categoryId}`)}
            onManage={() => setManagingCategories(true)}
            onUnreachable={showUnreachable}
          />
          <ExpenseList
            expenses={expenses}
            status={listStatus}
            onRetry={loadAll}
            onEdit={setEditing}
            success={successFor('expenses')}
            onDeleted={() => succeeded('Expense deleted', 'expenses')}
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
      {managingCategories && (
        <ManageCategoriesModal
          categories={categories}
          success={successFor('categories')}
          onSuccess={(message) => showSuccess(message, 'categories')}
          onChanged={loadAll}
          onClose={closeManageCategories}
          onUnreachable={showUnreachable}
        />
      )}
    </>
  )
}

export default App
