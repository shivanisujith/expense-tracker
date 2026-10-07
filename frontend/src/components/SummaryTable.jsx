import { useState } from 'react'
import { setLimit } from '../api.js'
import { formatMonth } from '../dates.js'
import { formatRupees, paiseToRupeesText, parseRupees } from '../money.js'

// status: 'loading' | 'loaded' | 'error' | 'unreachable'
function SummaryTable({ summary, status, onRetry, onLimitSaved, onUnreachable }) {
  const [editingCategory, setEditingCategory] = useState(null)

  return (
    <section className="card">
      <h2>This month{summary && `: ${formatMonth(summary.month)}`}</h2>
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
        <ul className="summary-list">
          {summary.categories.map((row) => (
            <SummaryRow
              key={row.category}
              row={row}
              editing={editingCategory === row.category}
              onEdit={() => setEditingCategory(row.category)}
              onClose={() => setEditingCategory(null)}
              onLimitSaved={() => {
                setEditingCategory(null)
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

function SummaryRow({ row, editing, onEdit, onClose, onLimitSaved, onUnreachable }) {
  const hasLimit = row.limit_paise !== null

  return (
    <li className={row.over_limit ? 'summary-row over-limit' : 'summary-row'}>
      <div className="summary-heading">
        <span className="summary-category">{row.category}</span>
        {!editing && (
          <button type="button" className="secondary" onClick={onEdit}>
            {hasLimit ? 'Change limit' : 'Set limit'}
          </button>
        )}
      </div>

      <dl className="summary-numbers">
        <div>
          <dt>Spent</dt>
          <dd>{formatRupees(row.spent_paise)}</dd>
        </div>
        <div>
          <dt>Limit</dt>
          <dd>{hasLimit ? formatRupees(row.limit_paise) : 'No limit set'}</dd>
        </div>
        {/* When over, the warning below replaces a negative "remaining". */}
        {!row.over_limit && (
          <div>
            <dt>Remaining</dt>
            <dd>{hasLimit ? formatRupees(row.remaining_paise) : '-'}</dd>
          </div>
        )}
      </dl>

      {row.over_limit && (
        <p className="over-limit-warning">
          Over limit by {formatRupees(row.spent_paise - row.limit_paise)}
        </p>
      )}

      {editing && (
        <LimitEditor
          category={row.category}
          currentLimit={row.limit_paise}
          onCancel={onClose}
          onSaved={onLimitSaved}
          onUnreachable={onUnreachable}
        />
      )}
    </li>
  )
}

function LimitEditor({ category, currentLimit, onCancel, onSaved, onUnreachable }) {
  const [value, setValue] = useState(currentLimit === null ? '' : paiseToRupeesText(currentLimit))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputId = `limit-${category}`

  async function handleSubmit(event) {
    event.preventDefault()
    const parsed = parseRupees(value)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    setError('')
    setSaving(true)
    try {
      await setLimit(category, parsed.paise)
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
      <label htmlFor={inputId}>Monthly limit for {category} (Rs)</label>
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

export default SummaryTable
