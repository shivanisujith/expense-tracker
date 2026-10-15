import { useCallback, useEffect, useRef, useState } from 'react'

export const SUCCESS_MS = 3000

/**
 * Holds the one success message on the page (specs/frontend-spec.md,
 * section 7). Returns { success, showSuccess, clearSuccess }. `success` is
 * null or { message, place, key }. `place` says which box shows it:
 * 'expenses', 'categories', or 'card-<category id>'. The key
 * changes on every showSuccess, even for the same message, so it is shown
 * and announced again.
 */
export function useSuccessMessage() {
  const [success, setSuccess] = useState(null)
  const nextKey = useRef(0)

  useEffect(() => {
    if (success === null) return undefined
    const timer = setTimeout(() => setSuccess(null), SUCCESS_MS)
    return () => clearTimeout(timer)
  }, [success])

  const showSuccess = useCallback((message, place) => {
    nextKey.current += 1
    setSuccess({ message, place, key: nextKey.current })
  }, [])
  const clearSuccess = useCallback(() => setSuccess(null), [])

  return { success, showSuccess, clearSuccess }
}
