const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Today in the browser's own clock, as YYYY-MM-DD. */
export function todayText(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-10" -> "October 2026". */
export function formatMonth(text) {
  const [year, month] = text.split('-')
  return `${FULL_MONTHS[Number(month) - 1]} ${year}`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Today in the browser's own clock, e.g. "Thursday, 8 October 2026". */
export function formatFullDate(now = new Date()) {
  const weekday = WEEKDAYS[now.getDay()]
  return `${weekday}, ${now.getDate()} ${FULL_MONTHS[now.getMonth()]} ${now.getFullYear()}`
}

const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })

/** Today in IST, from the computer's clock, as YYYY-MM-DD. */
export function todayInIst(now = new Date()) {
  // en-CA writes dates as YYYY-MM-DD.
  return istDate.format(now)
}

/** The day before a YYYY-MM-DD date, as YYYY-MM-DD. */
function dayBefore(text) {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

/**
 * The day on an expense row: "Today", "Yesterday", "12 Oct" in the current
 * year, or "12 Oct 2025" in other years. `today` is today in IST.
 */
export function dayLabel(text, today = todayInIst()) {
  if (text === today) return 'Today'
  if (text === dayBefore(today)) return 'Yesterday'
  const [year, month, day] = text.split('-')
  const short = `${Number(day)} ${MONTHS[Number(month) - 1]}`
  return year === today.slice(0, 4) ? short : `${short} ${year}`
}
