const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Today in the browser's own clock, as YYYY-MM-DD. */
export function todayText(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** "2026-10-07" -> "7 Oct 2026". */
export function formatDate(text) {
  const [year, month, day] = text.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}
