// Money is handled as whole paise everywhere. Rupee text is converted with
// string arithmetic, never floating point, so 12.50 is always exactly 1250.

const NUMBER_PATTERN = /^-?(\d+)(?:\.(\d+))?$/

/** The largest amount or limit, Rs 10,00,00,000.00, as the backend allows. */
export const MAX_PAISE = 10_000_000_000

export const AMOUNT_MESSAGES = {
  empty: 'Please enter an amount.',
  notNumber: 'Amount must be a number, like 12.50.',
  notPositive: 'Amount must be greater than 0.',
  tooManyDecimals: 'Amount can have at most 2 decimal places.',
  tooLarge: 'Amount is too large.',
}

export const LIMIT_MESSAGES = {
  empty: 'Please enter a limit.',
  notNumber: 'Limit must be a number, like 5000.00.',
  notPositive: 'Limit must be greater than 0.',
  tooManyDecimals: 'Limit can have at most 2 decimal places.',
  tooLarge: 'Limit is too large.',
}

/**
 * Turns what the user typed (e.g. "12.50") into whole paise.
 * Returns { paise } on success or { error } with a message to show.
 */
export function parseRupees(text, messages = AMOUNT_MESSAGES) {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { error: messages.empty }
  }

  const match = NUMBER_PATTERN.exec(trimmed)
  if (!match) {
    return { error: messages.notNumber }
  }

  const [, whole, decimals = ''] = match
  const isZero = /^0*$/.test(whole + decimals)
  if (trimmed.startsWith('-') || isZero) {
    return { error: messages.notPositive }
  }
  if (decimals.length > 2) {
    return { error: messages.tooManyDecimals }
  }

  // Anything far too long for an exact number is also over the maximum.
  const paise = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (paise > MAX_PAISE) {
    return { error: messages.tooLarge }
  }
  return { paise }
}

/** Paise as plain rupee text for an input box, e.g. 1250 -> "12.50". */
export function paiseToRupeesText(paise) {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`
}

/** How full a category's progress bar is, from 0 to 100. Never more than full. */
export function limitUsedPercent(spentPaise, limitPaise) {
  return Math.min(100, (spentPaise / limitPaise) * 100)
}

const rupeeGrouping = new Intl.NumberFormat('en-IN')

/**
 * Formats paise for display, e.g. 12500050 -> "Rs 1,25,000.50". Anything
 * that isn't a whole number of paise (missing, text, decimals) shows
 * "Rs –", so the page never shows "NaN".
 */
export function formatRupees(paise) {
  if (!Number.isSafeInteger(paise)) return 'Rs –'
  const sign = paise < 0 ? '-' : ''
  const absolute = Math.abs(paise)
  const rupees = Math.floor(absolute / 100)
  const remainder = String(absolute % 100).padStart(2, '0')
  return `${sign}Rs ${rupeeGrouping.format(rupees)}.${remainder}`
}
