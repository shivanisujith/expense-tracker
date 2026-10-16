# Expense Tracker -- Backend Specification

Source of truth: `specs/goal-spec.md`. If anything here disagrees with the
goal spec, the goal spec wins. Exact requests and responses are in
`specs/api-contract-spec.md`.

## Plain-language terms
- **Backend:** the FastAPI program that checks, saves, and adds up the data.
- **Database:** where data is kept, so it survives restarts and page
  reloads.
  - **SQLite:** a database that is a single file on disk. Used on the
    laptop and in local tests.
  - **PostgreSQL:** a database that runs as its own server. Used online,
    hosted by Neon.
- **Environment variable:** a named setting the host gives the backend
  when it starts, such as `DATABASE_URL`. Secrets (like the database
  password) are kept there, never in the code.
- **CORS:** the browser rule that a page from one address may only read
  answers from a backend at another address if that backend allows the
  page's address.
- **Table:** like one sheet in a spreadsheet: rows of records, each with
  the same columns.
- **Paise:** money stored as a whole number of paise (Rs 12.50 = 1250), so
  totals are always exact.
- **IST:** India Standard Time. "Today" and "this month" are always worked
  out in IST, not the computer's own time zone.
- **Id:** a permanent whole number the database gives each row. It never
  changes, even when a category is renamed.
- **Migration:** a one-time step that converts an older database file to
  the current format, keeping all of its data.
- **Account:** one person's username and password. Every category belongs
  to one account, and expenses and limits belong to it through their
  category.
- **Password hash:** a scrambled, one-way fingerprint of a password. The
  backend can check a typed password against it, but nobody can turn it
  back into the password. Made with the `argon2-cffi` library, which also
  mixes in a random "salt", so the same password gives a different hash
  each time.
- **Session and token:** logging in starts a session. The backend gives
  the browser a token, a long random pass that the browser shows with
  every request (in the `Authorization` header) to prove who it is.
- **401 Unauthorized:** the status code for "you are not logged in, or
  your session has ended".

## Data stored

The backend uses **SQLite** when no `DATABASE_URL` is set (on the laptop
and in tests), and **PostgreSQL** when it is (online). Both have the same
five tables (users, sessions, categories, expenses, category_limits) and
follow every rule in this spec in the same way:
- Money columns hold whole paise: `INTEGER` in SQLite, `BIGINT` (a whole
  number up to about 9.2 × 10¹⁸) in PostgreSQL. Every sum is returned as
  a whole number of paise, never a decimal or floating-point number.
- Ids are never reused in either database, even after a row is deleted.
- Category names are unique **within one account**, ignoring capital
  letters, in both. (The backend also checks this itself, rule 14.)
  Usernames are unique in both.
- Every reference from an expense or limit to a category, from a category
  to its account, and from a session to its account, is checked by the
  database in both.

### Table: users
One row per account.

| Column        | Meaning                                                   |
|---------------|-----------------------------------------------------------|
| id            | Unique whole number, given by the database. Never reused. |
| username      | 3 to 20 characters, saved in lowercase. Unique.           |
| password_hash | The Argon2 hash of the password. Never the password itself. |
| created_at    | When the account was created.                             |

### Table: sessions
One row per logged-in session. A person may have several (for example,
two browsers).

| Column     | Meaning                                                     |
|------------|-------------------------------------------------------------|
| id         | Unique whole number, given by the database.                 |
| user_id    | The `id` of the account.                                    |
| token_hash | The SHA-256 fingerprint of the token. The token itself is never stored, so someone who copies the database file can't use it to log in. Unique. |
| created_at | When the person logged in (UTC).                            |
| expires_at | Exactly 7 days after `created_at` (UTC). Using the session does not extend it. |

### Table: categories
One row per category.

| Column  | Meaning                                                          |
|---------|------------------------------------------------------------------|
| id      | Unique whole number, given by the database. Never reused.        |
| user_id | The `id` of the account it belongs to. Empty only for old data not yet claimed (see "Upgrading to accounts"). |
| name    | 1 to 30 characters, no spaces at the start or end. Unique within the account when capital letters are ignored. |
| icon    | Which icon the frontend shows: `food`, `transport`, `shopping`, `bills`, `entertainment`, `other`, or `tag`. |

- **Category order:** by `id`, smallest first, within each account. Each
  account's starting six are created in the order Food, Transport,
  Shopping, Bills, Entertainment, Other, so they come first; new
  categories get larger ids (never reused), so they are added at the end.
  Ids are shared by all accounts, so a new account's starting six do
  **not** get ids 1 to 6.
  Renaming does not change the id, so a renamed category keeps its place.
- **Icons:** the starting six get the icons `food`, `transport`,
  `shopping`, `bills`, `entertainment`, and `other`, in that order. A
  category added later always gets `tag`, whatever its name. Renaming
  never changes the icon. The frontend chooses icons from this value.
- **Starting categories:** each new account starts with Food, Transport,
  Shopping, Bills, Entertainment, Other, created when it signs up (unless
  it takes over old data, see "Upgrading to accounts"). A brand-new
  database has no categories until the first account signs up.

### Table: expenses
One row per expense.

| Column       | Meaning                                                    |
|--------------|------------------------------------------------------------|
| id           | Unique whole number, given by the database. Never reused.  |
| amount_paise | Whole number of paise, greater than 0.                     |
| category_id  | The `id` of the expense's category.                        |
| date         | The day the money was spent, as YYYY-MM-DD.                |
| note         | Short text, 0 to 100 characters. Empty text if not given.  |
| created_at   | When the row was first saved. Used only for ordering.      |

Expenses point to their category by id, not by name. Renaming a category
only changes its name in the categories table, so its expenses go with it
automatically. The API still sends and receives category **names** for
expenses (see `specs/api-contract-spec.md`); the backend converts between
names and ids.

### Table: category_limits
At most one row per category. A category with no row has no limit.

| Column      | Meaning                                         |
|-------------|-------------------------------------------------|
| category_id | The `id` of the category. Unique.               |
| limit_paise | Whole number of paise, greater than 0.          |

A limit applies to every month. It is not set per month.

Expenses and limits have no `user_id` of their own: they belong to the
account that owns their category. That way ownership is written down in
only one place and can't disagree.

## Rules the backend enforces
The backend checks every rule itself, whatever the frontend has already
checked. If any rule fails, nothing is saved or changed, and the backend
answers with an error explaining which field failed and why.

### Account rules (sign up and log in)
A1. **username** is required and must be text. Spaces at the start and
    end are removed. It must then be 3 to 20 characters long, using only
    the letters a to z (capital or not), the digits 0 to 9, and `_`.
    Capital letters are ignored: it is saved in lowercase, so "Shivani"
    and "shivani" are the same account.
A2. A username already used by another account (after lowercasing) is
    refused as taken.
A3. **password** is required and must be text. It is used exactly as
    typed: spaces count and are not removed. It must be 8 to 64
    characters long.
A4. The password must not be the same as the username, ignoring capital
    letters.
A5. There are no rules about symbols, digits, or capital letters in the
    password; length matters most.
A6. Checks on sign up happen in this order, and the first failure is
    reported: A1, A2, A3 (too short, then too long), A4. Missing or
    non-text username or password is `invalid_request`.
A7. **Signing up** saves only the password's Argon2 hash, creates the
    account's categories (the six starting ones, or the old unclaimed
    data, see "Upgrading to accounts"), and starts a session, all as one
    all-or-nothing change.
A8. **Logging in:** the username is lowercased and spaces at the ends are
    removed; the password is checked against the stored hash with the
    library, never compared as text. A wrong username and a wrong
    password give exactly the same error. A missing or non-text username
    or password is `invalid_request`. Success starts a new session.
A9. **Logging out** deletes the session's row. Logging out with a token
    that is missing, unknown, or expired still succeeds, because the
    person is logged out either way.

### Session rules (every other endpoint)
S1. Every endpoint except sign up and log in needs the header
    `Authorization: Bearer <token>`.
S2. The token is 32 random bytes from Python's `secrets` module, written
    as text. Only its SHA-256 fingerprint is stored.
S3. No header, a badly written header, or a token with no matching
    session is refused with `not_logged_in`.
S4. A token whose session's `expires_at` has passed is refused with
    `session_expired`, and that session's row is deleted. "Now" is UTC.
S5. These checks come before every other check on the request, so a
    request without a valid session never learns anything or changes
    anything.

### Ownership rules (every data endpoint)
O1. Every list, total, summary, month list, and insight counts only the
    logged-in account's categories and their expenses and limits.
O2. An expense or category id that belongs to another account is treated
    **exactly** like an id that doesn't exist: same "not found" error,
    same message, and nothing changes. This way, guessing ids reveals
    nothing.
O3. An expense's `category` name is matched only against the logged-in
    account's own categories (rule 2), so an expense can never be put in
    another account's category.
O4. Category rules 14, 15, and 19 (unique names, at most 20, keep at
    least one) count only the logged-in account's categories.

### Expense rules (on add and on edit)
1. **amount_paise** is required, must be a whole number, must be
   greater than 0, and must be at most 10,000,000,000 paise
   (Rs 10,00,00,000.00). Refused: missing, empty, 0, negative, decimals
   such as 12.5, text such as "1250" or "abc", true/false, and null.
   Exactly 10,000,000,000 is accepted; anything above it is refused as
   too large. (This keeps every total exact, both in the database and on
   the page.)
2. **category** is required and must exactly match the name of one of the
   current categories, including capital letters. Anything else is
   refused, such as "food" when the category is called "Food", the name of
   a deleted category, or an empty value.
3. **date** is required, must be a real calendar date in YYYY-MM-DD form,
   and must not be after today in IST. Today itself is allowed.
4. **note** is optional. Spaces at the start and end are removed. After
   that it must be at most 100 characters. Missing or null is saved as
   empty text. If note is given but is not text (for example a number or
   a list), the request is refused with `invalid_request`.
5. Editing replaces all four fields at once (amount, category, date, note),
   and the same rules apply as when adding.
6. Editing or deleting an expense id that does not exist is refused with a
   "not found" error. An id in the address that is not a whole number
   (for example `/api/expenses/abc`) is refused with `invalid_request`,
   before any other check.

### Limit rules
7. The limit is set for a category given by its id, which must be one of
   the current categories. An id that doesn't exist is refused with a
   "not found" error.
8. **limit_paise** is required, must be a whole number, must be greater
   than 0, and must be at most 10,000,000,000 paise
   (Rs 10,00,00,000.00) (same checks as amount).
9. Setting a limit for a category that already has one replaces the old
   value. Limits can be changed but not removed (except by deleting the
   category, rule 18).

### Over-limit rule
10. Going over a limit never blocks saving an expense.
11. A category is **over limit** only when it has a limit and spent is
    strictly more than the limit. Spending exactly the limit is not over.

### Category rules
12. **name** (when adding or renaming) is required and must be text.
    Spaces at the start and end are removed first. Refused: missing, null,
    not text, or empty after removing spaces.
13. After removing spaces, the name must be at most 30 characters.
14. The name must not match any **other** category's name when capital
    letters are ignored. "food" is refused when "Food" exists. Renaming a
    category to its own name with different capitals (for example "food"
    to "Food") is allowed, because it is the same category.
15. There can be at most **20** categories. Adding a 21st is refused.
16. **Renaming** changes only the name. The category's id, place in the
    order, expenses (in every month), and limit all stay with it.
17. **Deleting** is refused if any expense, in any month, uses the
    category. The refusal says how many expenses use it.
18. Deleting a category that no expense uses also deletes its limit, if it
    has one.
19. The **last remaining** category can't be deleted.
20. Renaming or deleting a category id that does not exist is refused with
    a "not found" error. An id in the address that is not a whole number
    (for example `/api/categories/abc`) is refused with
    `invalid_request`, before any other check. The same applies to
    setting a limit.
21. Checks happen in this order, and the first failure is reported:
    - Adding: rules 12, 13, 14, then 15.
    - Renaming: "not found" (rule 20), then rules 12, 13, 14.
    - Deleting: "not found" (rule 20), then rule 19, then rule 17.

### Month rules (choosing a month for the list or a total)
22. A **month** is written as `YYYY-MM`: exactly four digits, a dash, and
    two digits from 01 to 12, for example `2026-09`. Anything else is
    refused as badly formatted, for example `2026-9`, `2026-13`,
    `September`, `2026-09-01`, or an empty value.
23. For a **month's total**, the month must not be after the current
    month (IST). The current month itself is allowed.
24. For the **expense list**, only rule 22 applies. A month after the
    current one is not refused; it simply has no expenses, because no
    expense can be dated in the future.

## Calculations

### Expense list
- Without a month: returns all expenses from every month.
- With a month (rule 22): returns only the expenses whose **date** is in
  that month. When they were saved doesn't matter.
- Each expense has its category's **current** name, its category's id,
  and its category's icon.
- Ordered newest date first. If two expenses have the same date, the one
  saved later comes first.

### Months with expenses
- Every month in which at least one expense is dated, each listed once,
  newest first. Empty when there are no expenses.
- The last one is the month of the earliest expense.

### Total for a month
- **total spent:** the exact sum of `amount_paise` for all expenses whose
  **date** is in the chosen month, whatever their category. 0 if there
  are none. Calculated the same way as the current month's total below,
  so for the current month both give the same amount.

### Category summary (current month only)
For each current category, always all of them, in category order:
- **category id, name, and icon.**
- **spent:** the exact sum of `amount_paise` for that category's expenses
  whose date is in the current month (IST). Expenses from other months are
  never counted. 0 if there are none.
- **limit:** the category's limit, or "no limit" if none is set.
- **remaining:** limit minus spent. This can be negative when over the
  limit. "No limit" when no limit is set.
- **over_limit:** true or false, following rule 11. Always false when no
  limit is set.

### Total spent this month
- **total spent:** the exact sum of `amount_paise` for **all** expenses
  whose date is in the current month (IST), whatever their category.
  Expenses from other months are never counted. 0 if there are none.
- It always equals the sum of every category's **spent** above, because
  every expense belongs to exactly one current category.
- It is part of the summary, so the page never adds amounts up itself.

### Insight for a month
Sent with the current month's summary and with any month's total, so the
Spent this month box can describe whichever month it shows. For the
**shown month** and the **month before it** (by expense date, as for all
month totals):
- **previous month:** the month before the shown month, as `YYYY-MM`
  (for January, December of the year before).
- **difference:** the shown month's total minus the month before's total,
  exact, in whole paise. Negative means less was spent than the month
  before, 0 means exactly the same. It is **"none"** (`null`) when the
  month before has no expenses at all, because there is nothing real to
  compare with.
- **biggest categories:** the categories with the largest spent amount in
  the shown month, by expense date, each with its id, **current** name, and icon,
  in category order. Normally one; several when they tie exactly. Empty
  when the shown month has no expenses.

All sums use whole paise only, so they are exact. The summary is also how
the frontend gets the current list of categories.

## Starting an empty online database
When the backend starts with `DATABASE_URL` set and the PostgreSQL
database has no tables yet, it creates the five tables, in one
all-or-nothing step, with no accounts or categories yet. If the tables
already exist, it changes nothing, so restarts and redeploys keep all
data. (In the login experiment this is used only by the tests; an online
database from before accounts is never upgraded.)

## Upgrading an existing database (migration)
This applies only to SQLite files on the laptop. The online PostgreSQL
database always starts in the current format.
Databases created before categories could be managed store each expense's
and limit's category as one of the six fixed names, and only allow those
six names. When the backend starts:

1. **Brand-new database** (no tables yet): create the five tables in the
   current format, with no accounts or categories yet.
2. **Already in the current format:** do nothing.
3. **Old format:** convert it, once, as below, and then upgrade it to
   accounts (see "Upgrading to accounts"):
   1. **Back up first.** Copy the database file, unchanged, to a new file
      next to it named `expenses.backup-before-categories-<date and
      time>.db` (for example
      `expenses.backup-before-categories-2026-10-10-143005.db`). If the
      backup can't be made, stop without changing anything and report the
      error.
   2. Create the categories table with the six starting categories, in
      their usual order.
   3. Rebuild the expenses and limits tables in the current format,
      copying every row and swapping each category name for its new id.
      Expense ids, amounts, dates, notes, and created_at values are kept
      exactly.
   4. Check that the number of expenses and limits after converting
      equals the number before. If not, undo everything and report the
      error.
   5. Steps 2 to 4 happen as one all-or-nothing change: if anything
      fails, the database is left exactly as it was.
- Backup files are `.db` files, so git ignores them like the main
  database file.

## Upgrading to accounts (migration)
This also applies only to SQLite files on the laptop. A database from
before accounts has categories, expenses, and limits but no `users`
table. When the backend starts with one:

1. **Back up first.** Copy the database file, unchanged, to a new file
   next to it named `<file name>.backup-before-login-<date and time>.db`
   (for example `expenses-login.backup-before-login-2026-10-16-143005.db`).
   Check the copy matches. If the backup can't be made, stop without
   changing anything and report the error.
2. Create the `users` and `sessions` tables.
3. Rebuild the categories table in the current format, copying every row
   with the same id and name, with `user_id` left empty ("unclaimed"),
   and the icon set from its id: ids 1 to 6 get `food`, `transport`,
   `shopping`, `bills`, `entertainment`, `other`; every other id gets
   `tag`. Expenses and limits are not changed.
4. Check that the number of categories, expenses, and limits after
   upgrading equals the number before. If not, undo everything and report
   the error.
5. Steps 2 to 4 happen as one all-or-nothing change.

**Unclaimed data:** categories with an empty `user_id`, and their
expenses and limits, are hidden from everyone. When the next account
signs up, it takes all of them (its id is written into their `user_id`)
instead of getting new starting categories, as part of the same
all-or-nothing sign-up step. After that, no unclaimed data is left, so
every later account starts with the six starting categories.

## Settings (environment variables)
| Name | Used for | Local default | Online value |
|---|---|---|---|
| `DATABASE_URL` | Which PostgreSQL database to use. **Secret:** it contains the database password. | not set, so SQLite is used | Neon's connection string, kept only in Render's settings |
| `EXPENSES_DB_PATH` | Which SQLite file to use (tests use temporary files) | `backend/expenses-login.db` on the `experiment/login` branch, so the real `backend/expenses.db` is never used by mistake | not used |
| `ALLOWED_ORIGINS` | Which page addresses may use the backend (CORS), separated by commas | `http://localhost:5173` | `https://shivanisujith.github.io` |

- CORS allows the `Authorization` header as well as `Content-Type`.
- Secrets are never written in code, commits, or test files.
- Session times (`created_at`, `expires_at`, "now") are in UTC, and tests
  can fix "now" the same way they fix "today".
- "Today" and "this month" are still worked out in IST on an online
  server whose own clock is set to UTC.

## Errors the backend can return
| Situation                                  | Kind of error   |
|--------------------------------------------|-----------------|
| Any input rule above fails (including a badly formatted or future month, or a username or password rule) | Validation error |
| Not logged in, or session expired          | Not logged in (401) |
| Wrong username or password when logging in | Not logged in (401) |
| Expense id does not exist, or belongs to another account | Not found |
| Category id does not exist, or belongs to another account | Not found |
| Something unexpected breaks on the server  | Server error    |

Every error has a short code, a plain-English message, and (for validation
errors about one field) the name of the field that failed. Exact shapes
are in `specs/api-contract-spec.md`.

## Out of scope (from the goal spec)
No password reset, account changes or deletion, email, login-attempt
limits, or shared data; the login version is never deployed. No other
currencies, no charts (except the progress bar on each category card), no
bank/UPI links, no receipts, no exports, no AI features.
