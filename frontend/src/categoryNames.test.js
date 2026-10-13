import { describe, expect, test } from 'vitest'
import { checkCategoryName } from './categoryNames.js'

const STARTING = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'].map(
  (name, index) => ({ id: index + 1, name }),
)

describe('checkCategoryName when adding', () => {
  test('a new name is accepted and trimmed', () => {
    expect(checkCategoryName('  Pets ', STARTING)).toEqual({ name: 'Pets' })
  })

  test.each(['', '   '])('"%s" is refused as empty', (text) => {
    expect(checkCategoryName(text, STARTING)).toEqual({ error: 'Please enter a category name.' })
  })

  test('30 characters are accepted, 31 are refused', () => {
    expect(checkCategoryName('x'.repeat(30), STARTING)).toEqual({ name: 'x'.repeat(30) })
    expect(checkCategoryName('x'.repeat(31), STARTING)).toEqual({
      error: 'Category name must be 30 characters or fewer.',
    })
  })

  test('spaces around a name do not count towards 30', () => {
    expect(checkCategoryName(`  ${'x'.repeat(30)}  `, STARTING)).toEqual({ name: 'x'.repeat(30) })
  })

  test.each(['Food', 'food', 'FOOD', ' fOoD '])('"%s" is a duplicate of Food', (text) => {
    expect(checkCategoryName(text, STARTING)).toEqual({
      error: 'A category called Food already exists.',
    })
  })

  test('a 21st category is refused', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `C${index}` }))
    expect(checkCategoryName('Pets', twenty)).toEqual({
      error: 'You can have at most 20 categories.',
    })
  })

  test('the name is checked before the count', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `C${index}` }))
    expect(checkCategoryName('', twenty)).toEqual({ error: 'Please enter a category name.' })
    expect(checkCategoryName('c0', twenty)).toEqual({ error: 'A category called C0 already exists.' })
  })
})

describe('checkCategoryName when renaming', () => {
  test('its own name with different capitals is allowed', () => {
    const categories = [...STARTING, { id: 7, name: 'pets' }]
    expect(checkCategoryName('Pets', categories, 7)).toEqual({ name: 'Pets' })
  })

  test("another category's name is still a duplicate", () => {
    expect(checkCategoryName('bills', STARTING, 1)).toEqual({
      error: 'A category called Bills already exists.',
    })
  })

  test('renaming is allowed even with 20 categories', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `C${index}` }))
    expect(checkCategoryName('New name', twenty, 1)).toEqual({ name: 'New name' })
  })
})
