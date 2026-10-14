# Expense Tracker -- Specification

## Goal
Let a person record their everyday expenses by category and set a monthly
spending limit for each category, so they can see how much they have spent
in each one and whether they are staying within its limit. The person can
also manage their own list of categories: add new ones, rename them, and
delete ones they no longer use.

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
    one of the current categories), date (required, not in the future),
    and a note (optional, short text).
  - A category limit: one of the current categories, and a monthly limit
    amount (greater than 0).
  - A category name, when adding or renaming a category: required, with
    spaces at the start and end removed, at most 30 characters, and not
    the same as another category's name when capital letters are ignored
    (so "food" is refused when "Food" exists).
  - Starting categories: Food, Transport, Shopping, Bills, Entertainment,
    Other. The person can then add, rename, and delete categories:
    - At most 20 categories, and at least one must always remain.
    - Renaming keeps the category's expenses and limit with it, under the
      new name.
    - Deleting is only allowed when no expense, in any month, uses the
      category. Deleting also removes the category's limit.
  - Existing expenses and limits are kept when the app is upgraded to
    support managing categories.
  - A month (year and month, for example September 2026): to choose which
    month's total to see, and which month's expenses to list.
- Outputs:
  - A list of expenses, newest first: either the expenses of one chosen
    month, or all expenses ("All months").
  - The months that have at least one expense, newest first.
  - The current list of categories, in order: the starting six first, then
    new ones in the order they were added. A renamed category keeps its
    place.
  - For each current category, for the current month: amount spent, the
    limit, and amount remaining.
  - The total amount spent in the current month, across all categories.
  - The total amount spent in any earlier month, across all categories,
    so the person can look back month by month. Expenses count in the
    month of their date, not the month they were saved.
  - A clear warning when a category is over its limit. Going over a limit
    does not block saving the expense.
  - A clear error message whenever an input is refused, including when a
    category can't be added, renamed, or deleted (for example "Can't
    delete Food: 4 expenses use it.").

## Acceptance Criteria
1. A user can add an expense with valid details, and after reloading the
   page it is still in the list.
   -- decided by: automated test, plus a manual browser check.
2. An amount that is 0, negative, not a number, or empty is refused with a
   clear message, and nothing is saved.
   -- decided by: automated test.
3. An expense dated in the future is refused with a clear message.
   -- decided by: automated test.
4. An expense with a category that is not one of the current categories
   is refused by the backend, even if the frontend sends it.
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
9. A user can add a category with a valid name. It appears as a category
   card and in the add form's and edit popup's category lists, and it is
   still there after reloading the page.
   -- decided by: automated test, plus a manual browser check.
10. A category name that is empty (or only spaces), longer than 30
    characters, or the same as another category's name ignoring capital
    letters is refused with a clear message, both when adding and when
    renaming, and nothing changes.
    -- decided by: automated test.
11. After a category is renamed, all of its expenses (in every month) show
    the new name, and its limit and this month's spent amount are
    unchanged under the new name.
    -- decided by: automated test, plus a manual browser check.
12. Deleting a category that any expense uses, in any month, is refused
    with a clear message saying how many expenses use it, and nothing
    changes.
    -- decided by: automated test.
13. Deleting a category that no expense uses removes it and its limit. It
    no longer appears as a card or in any category list, and expenses
    using that name are then refused.
    -- decided by: automated test, plus a manual browser check.
14. The last remaining category can't be deleted, and a 21st category
    can't be added; each is refused with a clear message.
    -- decided by: automated test.
15. When the app starts with a database from before categories could be
    managed, it first saves a backup copy of the database file, then
    converts it so that every existing expense and limit is kept, with
    the same amounts, dates, notes, and categories.
    -- decided by: automated test, using a database file in the old
    format.
16. The total spent this month equals the exact sum of every category's
    spent amount for the current month, excludes expenses from other
    months, and is calculated by the backend, not the page.
    -- decided by: automated test, plus a manual browser check.
17. The total for any month up to the current one equals the exact sum of
    the expenses dated in that month (whenever they were saved), and is
    calculated by the backend. A month in the future, or one not written
    as a real month, is refused with a clear message.
    -- decided by: automated test.
18. In the Spent this month box, the arrows move back and forward one
    month at a time and show that month's total. The box starts on the
    current month each time the page opens, the forward arrow can't go
    past the current month, and the back arrow can't go before the month
    of the earliest expense.
    -- decided by: automated test, plus a manual browser check.
19. Choosing a month in the Expenses box lists only the expenses dated in
    that month, newest first, and "All months" lists every expense. The
    filtering is done by the backend, and a month not written as a real
    month is refused with a clear message.
    -- decided by: automated test.
20. The Expenses box's month choice offers "All months" and every month
    that has at least one expense, newest first. It starts on the current
    month each time the page opens, says "No expenses in <month>." when
    the chosen month has none, and keeps the chosen month after an
    expense is added, edited, or deleted.
    -- decided by: automated test, plus a manual browser check.

## Output Files
- backend/: the FastAPI application, database models, and tests.
- frontend/: the React screens.
- specs/: the specification files. These must not be changed by the agent
  unless explicitly asked.
- The exact file structure is to be proposed in the implementation plan
  and reviewed before any code is written.

## Out of Scope
- Logins and multiple users (one person per copy of the app).
- Currencies other than Indian rupees.
- Charts and graphs. (Exception: a simple progress bar on each category card, showing how much of its limit is used, is allowed.)
- Bank or UPI connections.
- Receipt photos or scanning.
- Exporting to Excel or PDF.
- Any AI feature.