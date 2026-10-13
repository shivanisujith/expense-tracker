import { useState } from 'react'
import { setLimit } from '../api.js'
import { formatMonth } from '../dates.js'
import {
  LIMIT_MESSAGES,
  formatRupees,
  limitUsedPercent,
  paiseToRupeesText,
  parseRupees,
} from '../money.js'

// status: 'loading' | 'loaded' | 'error' | 'unreachable'
function CategoryCards({ summary, status, onRetry, onLimitSaved, onManage, onUnreachable }) {
  const [editingId, setEditingId] = useState(null)
  // The summary provides the category list, so managing waits for it.
  const loaded = summary !== null && status !== 'error'

  return (
    <section className="card category-section" aria-labelledby="categories-heading">
      <div className="section-heading">
        {/* The month comes with the cards, so it always matches what they count. */}
        <h2 id="categories-heading">
          {loaded ? `This month: ${formatMonth(summary.month)}` : 'This month'}
        </h2>
        <button type="button" className="secondary small" onClick={onManage} disabled={!loaded}>
          Manage categories
        </button>
      </div>
      {status === 'error' ? (
        <div className="section-error" role="alert">
          <p>Couldn't load the summary. Please try again.</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : summary === null ? (
        status === 'loading' && <p className="muted">Loading summary...</p>
      ) : (
        <ul className="category-grid">
          {summary.categories.map((row) => (
            <CategoryCard
              key={row.category_id}
              row={row}
              editing={editingId === row.category_id}
              onEdit={() => setEditingId(row.category_id)}
              onClose={() => setEditingId(null)}
              onLimitSaved={() => {
                setEditingId(null)
                onLimitSaved()
              }}
              onUnreachable={onUnreachable}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CategoryCard({ row, editing, onEdit, onClose, onLimitSaved, onUnreachable }) {
  const hasLimit = row.limit_paise !== null
  const percent = hasLimit ? limitUsedPercent(row.spent_paise, row.limit_paise) : 0

  return (
    <li className={row.over_limit ? 'card category-card over-limit' : 'card category-card'}>
      <div className="category-card-top">
        <h3 className="category-name">{row.category}</h3>
        {!editing && (
          <button type="button" className="secondary small" onClick={onEdit}>
            {hasLimit ? 'Change limit' : 'Set limit'}
          </button>
        )}
      </div>

      <p className="category-spent">
        {hasLimit
          ? `${formatRupees(row.spent_paise)} of ${formatRupees(row.limit_paise)}`
          : `${formatRupees(row.spent_paise)} spent`}
      </p>

      {hasLimit && (
        <div
          className="progress"
          role="progressbar"
          aria-label={`${row.category} limit used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      <p className={row.over_limit ? 'category-status over-limit-warning' : 'category-status'}>
        {row.over_limit
          ? `Over limit by ${formatRupees(row.spent_paise - row.limit_paise)}`
          : hasLimit
            ? `${formatRupees(row.remaining_paise)} left`
            : 'No limit set'}
      </p>

      {editing && (
        <LimitEditor
          categoryId={row.category_id}
          currentLimit={row.limit_paise}
          onCancel={onClose}
          onSaved={onLimitSaved}
          onUnreachable={onUnreachable}
        />
      )}
    </li>
  )
}

function LimitEditor({ categoryId, currentLimit, onCancel, onSaved, onUnreachable }) {
  const [value, setValue] = useState(currentLimit === null ? '' : paiseToRupeesText(currentLimit))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputId = `limit-${categoryId}`

  async function handleSubmit(event) {
    event.preventDefault()
    const parsed = parseRupees(value, LIMIT_MESSAGES)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    setError('')
    setSaving(true)
    try {
      await setLimit(categoryId, parsed.paise)
      onSaved()
    } catch (apiError) {
      if (apiError.kind === 'unreachable') onUnreachable()
      else setError(apiError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="limit-editor" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId}>Monthly limit (Rs)</label>
      <div className="limit-editor-controls">
        <input
          id={inputId}
          inputMode="decimal"
          placeholder="5000.00"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoFocus
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="field-error" id={`${inputId}-error`}>
          {error}
        </p>
      )}
    </form>
  )
}

export default CategoryCards
