// Money is handled as whole paise everywhere. Rupee text is converted with
// string arithmetic, never floating point, so 12.50 is always exactly 1250.

const NUMBER_PATTERN = /^-?(\d+)(?:\.(\d+))?$/

/**
 * Turns what the user typed (e.g. "12.50") into whole paise.
 * Returns { paise } on success or { error } with a message to show.
 */
export function parseRupees(text) {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { error: 'Please enter an amount.' }
  }

  const match = NUMBER_PATTERN.exec(trimmed)
  if (!match) {
    return { error: 'Amount must be a number, like 12.50.' }
  }

  const [, whole, decimals = ''] = match
  const isZero = /^0*$/.test(whole + decimals)
  if (trimmed.startsWith('-') || isZero) {
    return { error: 'Amount must be greater than 0.' }
  }
  if (decimals.length > 2) {
    return { error: 'Amount can have at most 2 decimal places.' }
  }

  const paise = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(paise)) {
    return { error: 'Amount is too large.' }
  }
  return { paise }
}

const rupeeGrouping = new Intl.NumberFormat('en-IN')

/** Formats paise for display, e.g. 12500050 -> "Rs 1,25,000.50". */
export function formatRupees(paise) {
  const sign = paise < 0 ? '-' : ''
  const absolute = Math.abs(paise)
  const rupees = Math.floor(absolute / 100)
  const remainder = String(absolute % 100).padStart(2, '0')
  return `${sign}Rs ${rupeeGrouping.format(rupees)}.${remainder}`
}
