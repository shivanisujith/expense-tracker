import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { getMonthTotal, getMonths, getSummary, listExpenses } from './api.js'
import CategoryCards from './components/CategoryCards.jsx'
import EditExpenseModal from './components/EditExpenseModal.jsx'
import ExpenseForm from './components/ExpenseForm.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import ManageCategoriesModal from './components/ManageCategoriesModal.jsx'
import ServerBanner from './components/ServerBanner.jsx'
import SpentThisMonth from './components/SpentThisMonth.jsx'
import { formatFullDate } from './dates.js'
import { ALL_MONTHS, currentMonthInIst, earliestMonth, monthOptions } from './months.js'
import { useSuccessMessage } from './successMessage.js'

function errorStatus(error) {
  return error.kind === 'unreachable' ? 'unreachable' : 'error'
}

function statusFor(result) {
  return result.status === 'fulfilled' ? 'loaded' : errorStatus(result.reason)
}

function App() {
  // Worked out once, so both month choices start here each time the page opens.
  const [currentMonth] = useState(currentMonthInIst)

  // Data is null until the first successful load, and kept on screen during reloads.
  const [expenses, setExpenses] = useState(null)
  const [summary, setSummary] = useState(null)
  const [months, setMonths] = useState(null)
  const [listStatus, setListStatus] = useState('loading')
  const [summaryStatus, setSummaryStatus] = useState('loading')
  const [unreachable, setUnreachable] = useState(false)

  // The Expenses box's month choice, and the month the Spent box shows. The
  // refs hold the latest choice, so a load that finishes after the choice
  // has changed again is ignored.
  const [listMonth, setListMonth] = useState(currentMonth)
  const [spentMonth, setSpentMonth] = useState(currentMonth)
  const listMonthRef = useRef(currentMonth)
  const spentMonthRef = useRef(currentMonth)
  // The total for spentMonth when it isn't the current month (the summary
  // has the current month's).
  const [monthTotal, setMonthTotal] = useState(null)
  const [monthTotalStatus, setMonthTotalStatus] = useState('loaded')
  const [retrying, setRetrying] = useState(false)

  // The expense open in the edit popup, or null when the popup is closed.
  const [editing, setEditing] = useState(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const { success, showSuccess, clearSuccess } = useSuccessMessage()

  // The current categories, in order, come from the summary.
  const categories = summary
    ? summary.categories.map((row) => ({ id: row.category_id, name: row.category }))
    : []

  // Each loader returns 'loaded', 'error', 'unreachable', or 'stale' (the
  // choice changed while it was loading, so the answer is dropped).
  const loadList = useCallback(async (month) => {
    try {
      const data = await listExpenses(month === ALL_MONTHS ? null : month)
      if (listMonthRef.current !== month) return 'stale'
      setExpenses(data)
      setListStatus('loaded')
      return 'loaded'
    } catch (error) {
      if (listMonthRef.current !== month) return 'stale'
      setListStatus(errorStatus(error))
      return errorStatus(error)
    }
  }, [])

  const loadMonthTotal = useCallback(
    async (month) => {
      if (month === currentMonth) return 'loaded'
      try {
        const data = await getMonthTotal(month)
        if (spentMonthRef.current !== month) return 'stale'
        setMonthTotal(data)
        setMonthTotalStatus('loaded')
        return 'loaded'
      } catch (error) {
        if (spentMonthRef.current !== month) return 'stale'
        setMonthTotalStatus(errorStatus(error))
        return errorStatus(error)
      }
    },
    [currentMonth],
  )

  // The frontend never works out totals itself: after every change it
  // reloads the list, the summary, the months, and the shown total from the
  // backend, keeping both month choices.
  const loadAll = useCallback(async () => {
    const [listResult, totalResult, [summaryResult, monthsResult]] = await Promise.all([
      loadList(listMonthRef.current),
      loadMonthTotal(spentMonthRef.current),
      Promise.allSettled([getSummary(), getMonths()]),
    ])
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
    if (monthsResult.status === 'fulfilled') setMonths(monthsResult.value)
    setSummaryStatus(statusFor(summaryResult))
    const statuses = [listResult, totalResult, statusFor(summaryResult), statusFor(monthsResult)]
    setUnreachable(statuses.includes('unreachable'))
  }, [loadList, loadMonthTotal])

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

  async function chooseListMonth(month) {
    listMonthRef.current = month
    setListMonth(month)
    setExpenses(null)
    setListStatus('loading')
    if ((await loadList(month)) === 'unreachable') showUnreachable()
  }

  async function showSpentMonth(month) {
    spentMonthRef.current = month
    setSpentMonth(month)
    setMonthTotal(null)
    setMonthTotalStatus('loading')
    if ((await loadMonthTotal(month)) === 'unreachable') showUnreachable()
  }

  const spentIsCurrent = spentMonth === currentMonth

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
        <SpentThisMonth
          month={spentMonth}
          currentMonth={currentMonth}
          data={spentIsCurrent ? summary : monthTotal}
          status={spentIsCurrent ? summaryStatus : monthTotalStatus}
          earliestMonth={earliestMonth(months)}
          onMonthChange={showSpentMonth}
        />
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
            month={listMonth}
            monthChoices={monthOptions(months, currentMonth, listMonth)}
            onMonthChange={chooseListMonth}
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
