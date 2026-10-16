// Which icon each category gets (specs/frontend-spec.md, "Category icons").
// The backend sends each category's icon value, which follows the category,
// not its name or id: the six starting categories keep theirs when renamed,
// and every category created later gets the default tag. Ids can't be used,
// because each account's starting six have different ids.

// Soft circle tints from the palette, each with an icon colour that passes
// 4.5 : 1 on it. Never red: red only means over limit or error.
export const CIRCLE_TONES = {
  sage: { circle: '#E3EAE0', icon: '#4F6F52' },
  pink: { circle: '#F6DCE6', icon: '#553047' },
  beige: { circle: '#EFE3CF', icon: '#5C4033' },
}

const STARTING_TONES = {
  food: 'pink',
  transport: 'sage',
  shopping: 'beige',
  bills: 'sage',
  entertainment: 'pink',
  other: 'beige',
}

const DEFAULT_ICON = { icon: 'tag', tone: 'sage' }

/** { icon, tone } for an icon value; the default tag for anything else. */
export function categoryIcon(iconValue) {
  return typeof iconValue === 'string' && Object.hasOwn(STARTING_TONES, iconValue)
    ? { icon: iconValue, tone: STARTING_TONES[iconValue] }
    : DEFAULT_ICON
}
