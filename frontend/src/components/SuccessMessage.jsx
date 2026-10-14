/**
 * The status area is always on the page (screen readers only announce
 * changes to an area that already exists). Clicks pass through it.
 */
function Toast({ toast }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.key} className="toast">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Toast
