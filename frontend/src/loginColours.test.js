// Every new text and background pair on the log in screen and the title row
// passes the readability rule (specs/frontend-spec.md, "Colours and
// contrast"): at least 4.5 : 1 for text, 3 : 1 for borders that carry
// meaning. The colours are read from App.css itself, so this checks what the
// page really uses.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
const colour = (name) => {
  const match = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`--${name} is not a colour in App.css`)
  return match[1]
}

// WCAG contrast, as used for the palette in the spec.
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const TEXT_PAIRS = [
  // [what, text colour, background]
  ['page title and subtitle on the pink page', 'subtitle', 'page'],
  ['"Expense Tracker" on the pink page', 'text', 'page'],
  ['waking note on the pink page', 'muted', 'page'],
  ['log in heading on the cream box', 'text', 'box'],
  ['field labels on the cream box', 'muted', 'box'],
  ['typed text in the fields', 'text', 'surface'],
  ['error messages on the cream box', 'danger', 'box'],
  ['Log in / Create account button', 'accent-text', 'accent'],
  ['the same button on hover', 'accent-text', 'accent-hover'],
  ['the switch link on the cream box', 'accent', 'box'],
  ['the switch link on hover', 'accent-hover', 'box'],
  ['Log out button', 'accent', 'surface'],
  ['Log out button on hover', 'accent', 'highlight'],
  ['server banner text', 'danger', 'danger-background'],
  ['server banner Try again button', 'accent-text', 'accent'],
]

test.each(TEXT_PAIRS)('%s passes 4.5 : 1', (_, text, background) => {
  expect(contrast(colour(text), colour(background))).toBeGreaterThanOrEqual(4.5)
})

test('a field with an error has a red border that passes 3 : 1 against its fill', () => {
  expect(contrast(colour('danger'), colour('surface'))).toBeGreaterThanOrEqual(3)
})

test('red is used on the log in screen only for errors', () => {
  const loginRules = css.slice(css.indexOf('.login-box {'), css.indexOf('/* Narrower than a laptop'))
  expect(loginRules).not.toMatch(/--danger/)
})
