// Category icons (specs/frontend-spec.md, "Category icons"): which icon and
// colours each category's icon value gets, and that every pair passes the
// readability rule.
import { expect, test } from 'vitest'
import { CIRCLE_TONES, categoryIcon } from './categoryIcons.js'

test.each([
  ['food', 'pink'],
  ['transport', 'sage'],
  ['shopping', 'beige'],
  ['bills', 'sage'],
  ['entertainment', 'pink'],
  ['other', 'beige'],
])('the %s icon value gets a %s circle', (icon, tone) => {
  expect(categoryIcon(icon)).toEqual({ icon, tone })
})

test('every category you create gets the default tag on sage, whatever its name', () => {
  expect(categoryIcon('tag')).toEqual({ icon: 'tag', tone: 'sage' })
})

test('an icon value the page doesn\'t know gets the tag, never an error', () => {
  for (const value of [undefined, null, '', 'Food', 'pets', 1, 7, 'constructor', '__proto__']) {
    expect(categoryIcon(value)).toEqual({ icon: 'tag', tone: 'sage' })
  }
})

test('the circle tones are exactly the ones in the spec', () => {
  expect(CIRCLE_TONES).toEqual({
    sage: { circle: '#E3EAE0', icon: '#4F6F52' },
    pink: { circle: '#F6DCE6', icon: '#553047' },
    beige: { circle: '#EFE3CF', icon: '#5C4033' },
  })
})

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

test.each(Object.entries(CIRCLE_TONES))(
  'the %s icon colour passes 4.5 : 1 on its circle',
  (_, { circle, icon }) => {
    expect(contrast(icon, circle)).toBeGreaterThanOrEqual(4.5)
  },
)

test('no icon colour or circle is red (red only means over limit or error)', () => {
  const reds = ['#B91C1C', '#DC2626', '#FBD5D5']
  for (const { circle, icon } of Object.values(CIRCLE_TONES)) {
    expect(reds).not.toContain(circle.toUpperCase())
    expect(reds).not.toContain(icon.toUpperCase())
  }
})
