// The page title (specs/frontend-spec.md, "Page title"): "Expense Tracker",
// a subtitle, and the "Waking up the server" note, sitting directly on the
// pink page. Buttons, if any, go at the right end of the row.

export const WAKING_NOTE = 'Waking up the server, this can take up to a minute...'

function PageTitle({ subtitle, waking, children }) {
  return (
    <header className="page-title">
      <div className="title-text">
        <h1>Expense Tracker</h1>
        <p className="page-subtitle">{subtitle}</p>
        {/* Always present, so screen readers announce the note when it appears. */}
        <p className="waking-note" role="status" aria-live="polite" aria-label="Server status">
          {waking ? WAKING_NOTE : ''}
        </p>
      </div>
      {children && <div className="title-buttons">{children}</div>}
    </header>
  )
}

export default PageTitle
