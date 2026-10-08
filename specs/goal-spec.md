# Expense Tracker -- Specification

## Goal
Let a person record their everyday expenses by category and set a monthly
spending limit for each category, so they can see how much they have spent
in each one and whether they are staying within its limit.

## Technology
- Chosen: React frontend, FastAPI backend, SQLite database.
- Weighed against: a plain spreadsheet. Rejected because a spreadsheet
  cannot refuse invalid entries (such as a negative amount) or warn when a
  category goes over its limit, and this course is about building and
  testing a real web application.
- Would revisit if: several people need to use it at the same time online,
  in which case we would switch SQLite to PostgreSQL.

## Constraints
- Money is stored exactly, as whole paise (Rs 12.50 is stored as 1250),
  never as floating-point numbers, so totals are always exact.
- One currency only: Indian rupees, with at most 2 decimal places.
- The backend enforces every rule itself; frontend checks are for
  convenience only and are never the only check.

## Inputs and Outputs
- Inputs:
  - An expense: amount (required, greater than 0), category (required,
    one of the fixed list), date (required, not in the future), and a
    note (optional, short text).
  - A category limit: a category from the fixed list, and a monthly limit
    amount (greater than 0).
  - Fixed categories: Food, Transport, Shopping, Bills, Entertainment, Other.
- Outputs:
  - A list of expenses, newest first.
  - For each category, for the current month: amount spent, the limit,
    and amount remaining.
  - A clear warning when a category is over its limit. Going over a limit
    does not block saving the expense.
  - A clear error message whenever an input is refused.

## Acceptance Criteria
1. A user can add an expense with valid details, and after reloading the
   page it is still in the list.
   -- decided by: automated test, plus a manual browser check.
2. An amount that is 0, negative, not a number, or empty is refused with a
   clear message, and nothing is saved.
   -- decided by: automated test.
3. An expense dated in the future is refused with a clear message.
   -- decided by: automated test.
4. An expense with a category not in the fixed list is refused by the
   backend, even if the frontend sends it.
   -- decided by: automated test.
5. After an expense is edited or deleted, the list and the category totals
   reflect the change.
   -- decided by: automated test.
6. A category's "spent" amount equals the exact sum of that category's
   expenses in the current month, and excludes expenses from other months.
   -- decided by: automated test.
7. When an expense takes a category over its limit, the expense is saved
   and that category shows an over-limit warning.
   -- decided by: automated test, plus a manual browser check.
8. If the frontend cannot reach the backend, the page shows a clear
   "Can't reach the server" message instead of a blank or broken page.
   -- decided by: manual browser check, with the backend stopped on purpose.

## Output Files
- backend/: the FastAPI application, database models, and tests.
- frontend/: the React screens.
- specs/: the specification files. These must not be changed by the agent
  unless explicitly asked.
- The exact file structure is to be proposed in the implementation plan
  and reviewed before any code is written.

## Out of Scope
- Logins and multiple users (one person per copy of the app).
- Creating, renaming, or deleting categories (the list is fixed).
- Currencies other than Indian rupees.
- Charts and graphs. (Exception: a simple progress bar on each category card, showing how much of its limit is used, is allowed.)
- Bank or UPI connections.
- Receipt photos or scanning.
- Exporting to Excel or PDF.
- Any AI feature.