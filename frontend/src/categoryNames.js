// Frontend checks for category names (specs/frontend-spec.md, section 5).
// The backend checks again; these just give quick, friendly messages.

import { CATEGORY_NAME_MAX_LENGTH, MAX_CATEGORIES } from './categories.js'

/**
 * Checks a name for a new category (ownId null) or for renaming the
 * category with id ownId. `categories` is the current list of { id, name }.
 * Returns { name } (trimmed) on success or { error } with a message.
 */
export function checkCategoryName(text, categories, ownId = null) {
  const name = text.trim()
  if (name === '') {
    return { error: 'Please enter a category name.' }
  }
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return { error: 'Category name must be 30 characters or fewer.' }
  }
  const duplicate = categories.find(
    (category) => category.id !== ownId && category.name.toLowerCase() === name.toLowerCase(),
  )
  if (duplicate) {
    return { error: `A category called ${duplicate.name} already exists.` }
  }
  if (ownId === null && categories.length >= MAX_CATEGORIES) {
    return { error: 'You can have at most 20 categories.' }
  }
  return { name }
}
