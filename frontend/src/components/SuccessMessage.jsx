/**
 * A status area for one box. It is always on the page (screen readers only
 * announce changes to an area that already exists) and takes no space
 * while empty. `success` is the message for this box, or null.
 */
function SuccessMessage({ success, className = '' }) {
  return (
    <div className={`success-region ${className}`} role="status" aria-live="polite">
      {success && (
        <p key={success.key} className="success-message">
          <span aria-hidden="true">✓ </span>
          {success.message}
        </p>
      )}
    </div>
  )
}

export default SuccessMessage
