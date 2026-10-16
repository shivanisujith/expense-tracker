import { CIRCLE_TONES, categoryIcon } from '../categoryIcons.js'
import { CategoryIcon } from './icons.jsx'

/** The icon for a category's icon value (specs/frontend-spec.md, "Category icons"). */
function CategoryIconFor({ iconValue }) {
  const { icon, tone } = categoryIcon(iconValue)
  return <CategoryIcon icon={icon} colours={CIRCLE_TONES[tone]} />
}

export default CategoryIconFor
