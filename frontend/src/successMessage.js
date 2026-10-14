import { useCallback, useEffect, useRef, useState } from 'react'

export const TOAST_MS = 3000

/**
 * Holds the current success message (specs/frontend-spec.md, section 7).
 * Returns { toast, showToast, clearToast }. `toast` is null or
 * { message, key }; the key changes on every showToast, even for the same
 * message, so it is shown and announced again.
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const nextKey = useRef(0)

  useEffect(() => {
    if (toast === null) return undefined
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = useCallback((message) => {
    nextKey.current += 1
    setToast({ message, key: nextKey.current })
  }, [])
  const clearToast = useCallback(() => setToast(null), [])

  return { toast, showToast, clearToast }
}
