# Expense Tracker -- Backend Specification

Source of truth: `specs/goal-spec.md`. If anything here disagrees with the
goal spec, the goal spec wins. Exact requests and responses are in
`specs/api-contract-spec.md`.

## Plain-language terms
- **Backend:** the FastAPI program that checks, saves, and adds up the data.
- **Database / SQLite:** a single file on disk where data is kept, so it
  survives restarts and page reloads.
- **Table:** like one sheet in a spreadsheet: rows of records, each with
  the same columns.
- **Paise:** money stored as a whole number of paise (Rs 12.50 = 1250), so
  totals are always exact.
- **IST:** India Standard Time. "Today" and "this month" are always worked
  out in IST, not the computer's own time zone.

## Data stored

### Table: expenses
One row per expense.

| Column       | Meaning                                                    |
|--------------|------------------------------------------------------------|
| id           | Unique whole number, given by the database. Never reused.  |
| amount_paise | Whole number of paise, greater than 0.                     |
| category     | One of the fixed categories (see below).                   |
| date         | The day the money was spent, as YYYY-MM-DD.                |
| note         | Short text, 0 to 100 characters. Empty text if not given.  |
| created_at   | When the row was first saved. Used only for ordering.      |

### Table: category_limits
At most one row per category. A category with no row has no limit.

| Column      | Meaning                                         |
|-------------|-------------------------------------------------|
| category    | One of the fixed categories. Unique.            |
| limit_paise | Whole number of paise, greater than 0.          |

A limit applies to every month. It is not set per month.

### Fixed categories
Food, Transport, Shopping, Bills, Entertainment, Other.
This exact spelling and capitalisation. The list is built into the backend
and cannot be changed through the app.

## Rules the backend enforces
The backend checks every rule itself, whatever the frontend has already
checked. If any rule fails, nothing is saved or changed, and the backend
answers with an error explaining which field failed and why.

### Expense rules (on add and on edit)
1. **amount_paise** is required, must be a whole number, and must be
   greater than 0. Refused: missing, empty, 0, negative, decimals such as
   12.5, text such as "1250" or "abc", true/false, and null.
2. **category** is required and must exactly match one of the fixed
   categories. Anything else is refused, such as "food", "Travel", or an
   empty value.
3. **date** is required, must be a real calendar date in YYYY-MM-DD form,
   and must not be after today in IST. Today itself is allowed.
4. **note** is optional. Spaces at the start and end are removed. After
   that it must be at most 100 characters. Missing or null is saved as
   empty text.
5. Editing replaces all four fields at once (amount, category, date, note),
   and the same rules apply as when adding.
6. Editing or deleting an expense id that does not exist is refused with a
   "not found" error.

### Limit rules
7. The category must be one of the fixed categories.
8. **limit_paise** is required, must be a whole number, and must be greater
   than 0 (same checks as amount).
9. Setting a limit for a category that already has one replaces the old
   value. Limits can be changed but not removed.

### Over-limit rule
10. Going over a limit never blocks saving an expense.
11. A category is **over limit** only when it has a limit and spent is
    strictly more than the limit. Spending exactly the limit is not over.

## Calculations

### Expense list
- Returns all expenses from every month.
- Ordered newest date first. If two expenses have the same date, the one
  saved later comes first.

### Category summary (current month only)
For each of the six categories, always all six, in the fixed order above:
- **spent:** the exact sum of `amount_paise` for that category's expenses
  whose date is in the current month (IST). Expenses from other months are
  never counted. 0 if there are none.
- **limit:** the category's limit, or "no limit" if none is set.
- **remaining:** limit minus spent. This can be negative when over the
  limit. "No limit" when no limit is set.
- **over_limit:** true or false, following rule 11. Always false when no
  limit is set.

All sums use whole paise only, so they are exact.

## Errors the backend can return
| Situation                                  | Kind of error   |
|--------------------------------------------|-----------------|
| Any input rule above fails                 | Validation error |
| Expense id does not exist                  | Not found       |
| Something unexpected breaks on the server  | Server error    |

Every error has a short code, a plain-English message, and (for validation
errors) the name of the field that failed. Exact shapes are in
`specs/api-contract-spec.md`.

## Out of scope (from the goal spec)
No logins or multiple users, no adding/renaming/deleting categories, no
other currencies, no charts, no bank/UPI links, no receipts, no exports,
no AI features.
