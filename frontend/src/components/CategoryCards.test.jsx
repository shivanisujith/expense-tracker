// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import CategoryCards from './CategoryCards.jsx'

afterEach(cleanup)

const noop = () => {}

function row(id, name, spent, icon = 'tag') {
  return {
    category_id: id,
    category: name,
    icon,
    spent_paise: spent,
    limit_paise: null,
    remaining_paise: null,
    over_limit: false,
  }
}

function renderCards(summary, status = 'loaded') {
  return render(
    <CategoryCards
      summary={summary}
      status={status}
      success={null}
      onRetry={noop}
      onLimitSaved={noop}
      onManage={noop}
      onUnreachable={noop}
    />,
  )
}

test('the category box no longer shows the total (it has its own box)', () => {
  renderCards({
    month: '2026-10',
    total_spent_paise: 9210,
    categories: [row(1, 'Food', 9210), row(2, 'Bills', 0)],
  })

  expect(screen.queryByText(/Total spent/)).toBeNull()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

// --- Category icons (specs/frontend-spec.md, "Category icons") ---

function cardIcon(name) {
  const card = screen.getByRole('heading', { name }).closest('li')
  return card.querySelector('.category-icon')
}

test('each card shows its category icon, just before the name', () => {
  renderCards({
    month: '2026-10',
    total_spent_paise: 0,
    categories: [row(1, 'Food', 0, 'food'), row(4, 'Bills', 0, 'bills'), row(7, 'Pets', 0, 'tag')],
  })

  expect(cardIcon('Food').dataset.icon).toBe('food')
  expect(cardIcon('Bills').dataset.icon).toBe('bills')
  expect(cardIcon('Pets').dataset.icon).toBe('tag')
  expect(cardIcon('Food').nextElementSibling.textContent).toBe('Food')
})

test('the icon follows the category: renamed Food keeps it, a new "Food" gets the default', () => {
  renderCards({
    month: '2026-10',
    total_spent_paise: 0,
    categories: [row(1, 'Groceries', 0, 'food'), row(8, 'Food', 0, 'tag')],
  })

  expect(cardIcon('Groceries').dataset.icon).toBe('food')
  expect(cardIcon('Food').dataset.icon).toBe('tag')
})

test('the icon comes from the icon value, not the id (each account has its own ids)', () => {
  renderCards({
    month: '2026-10',
    total_spent_paise: 0,
    categories: [row(9, 'Food', 0, 'food'), row(12, 'Bills', 0, 'bills'), row(1, 'Pets', 0, 'tag')],
  })

  expect(cardIcon('Food').dataset.icon).toBe('food')
  expect(cardIcon('Bills').dataset.icon).toBe('bills')
  expect(cardIcon('Pets').dataset.icon).toBe('tag')
})

test('icons are hidden from screen readers, and the circle uses its tone', () => {
  renderCards({ month: '2026-10', total_spent_paise: 0, categories: [row(1, 'Food', 0, 'food')] })

  const icon = cardIcon('Food')
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  expect(icon.style.backgroundColor).toBe('rgb(246, 220, 230)') // #F6DCE6, soft pink
  expect(icon.style.color).toBe('rgb(85, 48, 71)') // #553047, plum
  expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy()
})

test('an over-limit card keeps the icon tint; it never turns red', () => {
  const over = { ...row(4, 'Bills', 6000, 'bills'), limit_paise: 5000, remaining_paise: -1000, over_limit: true }
  renderCards({ month: '2026-10', total_spent_paise: 6000, categories: [over] })

  expect(cardIcon('Bills').style.backgroundColor).toBe('rgb(227, 234, 224)') // #E3EAE0
  expect(cardIcon('Bills').style.color).toBe('rgb(79, 111, 82)') // #4F6F52
})
