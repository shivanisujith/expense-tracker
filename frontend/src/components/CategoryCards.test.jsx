// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import CategoryCards from './CategoryCards.jsx'

afterEach(cleanup)

const noop = () => {}

function row(id, name, spent) {
  return {
    category_id: id,
    category: name,
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
