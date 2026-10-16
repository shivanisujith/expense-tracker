// Which icon each category gets (specs/frontend-spec.md, "Category icons").
// The icon follows the category's id, not its name: the six starting
// categories are ids 1 to 6 and keep their icons when renamed; every
// category created later gets the default tag.

// Soft circle tints from the palette, each with an icon colour that passes
// 4.5 : 1 on it. Never red: red only means over limit or error.
export const CIRCLE_TONES = {
  sage: { circle: '#E3EAE0', icon: '#4F6F52' },
  pink: { circle: '#F6DCE6', icon: '#553047' },
  beige: { circle: '#EFE3CF', icon: '#5C4033' },
}

const STARTING_ICONS = {
  1: { icon: 'food', tone: 'pink' },
  2: { icon: 'transport', tone: 'sage' },
  3: { icon: 'shopping', tone: 'beige' },
  4: { icon: 'bills', tone: 'sage' },
  5: { icon: 'entertainment', tone: 'pink' },
  6: { icon: 'other', tone: 'beige' },
}

const DEFAULT_ICON = { icon: 'tag', tone: 'sage' }

/** { icon, tone } for a category id; the default for anything else. */
export function categoryIcon(categoryId) {
  return (Number.isInteger(categoryId) && STARTING_ICONS[categoryId]) || DEFAULT_ICON
}
