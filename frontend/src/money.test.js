import { describe, expect, test } from 'vitest'
import { formatRupees, paiseToRupeesText, parseRupees } from './money.js'

describe('parseRupees', () => {
  test.each([
    ['12.50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['0.1', 10],
    ['0.01', 1],
    ['0.29', 29],
    ['1.00', 100],
    ['125000.50', 12500050],
    ['  12.50  ', 1250],
    ['007', 700],
  ])('"%s" becomes %i paise', (text, paise) => {
    expect(parseRupees(text)).toEqual({ paise })
  })

  test.each(['', '   '])('empty input "%s" is refused', (text) => {
    expect(parseRupees(text)).toEqual({ error: 'Please enter an amount.' })
  })

  test.each(['abc', '12abc', '1,250', '12.', '.5', '1e3', '+5', '12.50.1', 'Rs 12'])(
    '"%s" is not a number',
    (text) => {
      expect(parseRupees(text)).toEqual({ error: 'Amount must be a number, like 12.50.' })
    },
  )

  test.each(['0', '0.00', '-5', '-0.01', '-12.345'])('"%s" is not greater than 0', (text) => {
    expect(parseRupees(text)).toEqual({ error: 'Amount must be greater than 0.' })
  })

  test.each(['12.345', '0.001', '1.999'])('"%s" has too many decimal places', (text) => {
    expect(parseRupees(text)).toEqual({ error: 'Amount can have at most 2 decimal places.' })
  })

  test('an amount too large to store exactly is refused', () => {
    expect(parseRupees('999999999999999999')).toEqual({ error: 'Amount is too large.' })
  })
})

describe('formatRupees', () => {
  test.each([
    [12500050, 'Rs 1,25,000.50'],
    [1250, 'Rs 12.50'],
    [1, 'Rs 0.01'],
    [0, 'Rs 0.00'],
    [10000000, 'Rs 1,00,000.00'],
    [1000000000, 'Rs 1,00,00,000.00'],
    [-5000, '-Rs 50.00'],
  ])('%i paise is shown as "%s"', (paise, text) => {
    expect(formatRupees(paise)).toBe(text)
  })
})

describe('paiseToRupeesText', () => {
  test.each([
    [1250, '12.50'],
    [1, '0.01'],
    [100, '1.00'],
    [12500050, '125000.50'],
  ])('%i paise is written as "%s"', (paise, text) => {
    expect(paiseToRupeesText(paise)).toBe(text)
  })

  test.each([1, 1250, 99999, 12500050])('%i paise survives a round trip', (paise) => {
    expect(parseRupees(paiseToRupeesText(paise))).toEqual({ paise })
  })
})
