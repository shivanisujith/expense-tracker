import { CIRCLE_TONES, categoryIcon } from '../categoryIcons.js'
import { CategoryIcon } from './icons.jsx'

/** The icon for a category id (specs/frontend-spec.md, "Category icons"). */
function CategoryIconFor({ categoryId }) {
  const { icon, tone } = categoryIcon(categoryId)
  return <CategoryIcon icon={icon} colours={CIRCLE_TONES[tone]} />
}

export default CategoryIconFor
