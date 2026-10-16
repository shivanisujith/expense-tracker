# Expense Tracker -- Specification

## Goal
Let a person record their everyday expenses by category and set a monthly
spending limit for each category, so they can see how much they have spent
in each one and whether they are staying within its limit. The person can
also manage their own list of categories: add new ones, rename them, and
delete ones they no longer use.

Each person has their own account (a username and password). After
logging in, they see and change only their own expenses, categories, and
limits.

## Technology
- Chosen: React frontend, FastAPI backend.
  - Database: SQLite on the laptop (a single file), and PostgreSQL online.
    Both use the same tables and rules, and money is whole paise in both.
- Deployed online, so anyone with the link can use it:
  - Frontend: GitHub Pages, at
    https://shivanisujith.github.io/expense-tracker/.
  - Backend: Render (free plan).
  - Database: PostgreSQL hosted by Neon (free plan). Render's free disk is
    wiped on every restart and redeploy, so the data can't live in a
    SQLite file there. Render's own free PostgreSQL was rejected because
    it is deleted 30 days after it is created.
  - GitHub Actions runs every backend and frontend test on every push, and
    deploys only when they all pass.
- Weighed against: a plain spreadsheet. Rejected because a spreadsheet
  cannot refuse invalid entries (such as a negative amount) or warn when a
  category goes over its limit, and this course is about building and
  testing a real web application.
- Would revisit if: the app needs logins or more than a course demo's
  traffic, in which case we would move to paid plans that don't sleep and
  that keep backups.
- **Login experiment (branch `experiment/login`):** accounts are a local
  learning experiment. This version runs on the laptop only, with its own
  database file (`backend/expenses-login.db`), and is never deployed,
  merged, or pushed. The online app above stays as it is, without login.
  - Passwords are hashed with `argon2-cffi` (the Argon2id method, the
    current recommended way to store passwords). The typed password is
    never stored.

## Constraints
- Money is stored exactly, as whole paise (Rs 12.50 is stored as 1250),
  never as floating-point numbers, so totals are always exact.
- One currency only: Indian rupees, with at most 2 decimal places.
- The backend enforces every rule itself; frontend checks are for
  convenience only and are never the only check.

## Inputs and Outputs
- Inputs:
  - An account, when signing up or logging in: a username (3 to 20
    characters: letters, numbers, and underscores; capital letters
    ignored) and a password (8 to 64 characters, not the same as the
    username). The exact rules are in `specs/backend-spec.md`.
  - An expense: amount (required, greater than 0, at most
    Rs 10,00,00,000.00), category (required, one of the current
    categories), date (required, not in the future), and a note
    (optional, short text).
  - A category limit: one of the current categories, and a monthly limit
    amount (greater than 0, at most Rs 10,00,00,000.00).
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
  - Existing expenses, categories, and limits are kept when the app is
    upgraded to support accounts. They all go to the first account that
    signs up afterwards. Every later account starts with its own six
    starting categories.
  - Category names, the 20-category limit, and the starting categories
    all count per account: two accounts can each have a "Food".
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
  - For the month shown in the Spent this month box: how its total
    compares with the month before (an exact difference, or nothing when
    the month before has no expenses), and which category, or tied
    categories, it spent the most on.
  - A clear warning when a category is over its limit. Going over a limit
    does not block saving the expense.
  - A clear error message whenever an input is refused, including when a
    category can't be added, renamed, or deleted (for example "Can't
    delete Food: 4 expenses use it."), and when signing up or logging in
    fails.
  - A clear message when the person is not logged in or their session has
    expired, followed by the log in screen.
- Every output above is for the logged-in person only.

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
   card and in the add expense popup's and edit popup's category lists,
   and it is still there after reloading the page.
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
21. An amount or limit above Rs 10,00,00,000.00 is refused with a clear
    message, and nothing is saved. Exactly Rs 10,00,00,000.00 is
    accepted.
    -- decided by: automated test.
22. The public site works end to end (the expense, limit, category, and
    month features, and the "Can't reach the server" message), its data
    survives a backend restart and redeploy, and it is deployed only when
    every backend and frontend test has passed.
    -- decided by: CI run (GitHub Actions), plus a manual browser check on
    the public site.
23. The insight for a month states the exact difference from the month
    before's total, names the biggest category (all of them on a tie), is
    calculated by the backend, and leaves out any part that doesn't apply.
    -- decided by: automated test, plus a manual browser check.

Criteria 24 to 33 cover the login experiment. With login, criteria 1 to
23 are read as "for the logged-in user, using only their own data".

24. A user can sign up with a valid username and password. The account is
    created, they are logged in straight away, and after reloading the
    page they are still logged in.
    -- decided by: automated test, plus a manual browser check.
25. A username or password that breaks a rule (username too short, too
    long, or with characters other than letters, numbers, and
    underscores; password too short or too long, or the same as the
    username) is refused with the clear message for that rule, and no
    account is created.
    -- decided by: automated test.
26. Signing up with a username that is already taken, ignoring capital
    letters, is refused with "That username is already taken.", and no
    account is created.
    -- decided by: automated test.
27. Passwords are stored only as Argon2 hashes, made by a well-known
    library: the database never contains the typed password, and two
    accounts with the same password get different hashes.
    -- decided by: automated test.
28. Logging in with a wrong username or a wrong password gives the same
    message, "Username or password is incorrect.", so it doesn't reveal
    which usernames exist.
    -- decided by: automated test.
29. After logging out, the old session can no longer be used: requests
    with it are refused, and the page shows the log in screen.
    -- decided by: automated test, plus a manual browser check.
30. Every expense, category, limit, month, and summary request without a
    valid session is refused with "Please log in to continue." (status
    401), and nothing changes.
    -- decided by: automated test.
31. A session ends 7 days after logging in. After that, its requests are
    refused with "Your session has expired. Please log in again.", and
    the page shows the log in screen with that message.
    -- decided by: automated test, with a fixed clock.
32. With two accounts, each sees only their own expenses, categories,
    limits, months, totals, and insight. Using another account's expense
    or category id (editing, deleting, renaming, or setting a limit)
    gives the same "not found" error as an id that doesn't exist, and
    changes nothing. An expense can only use the user's own categories.
    -- decided by: automated test.
33. When the app starts with a database from before accounts existed, it
    first saves a backup copy of the database file, then upgrades it so
    every existing expense, category, and limit is kept unchanged. The
    first account to sign up then owns all of it; later accounts start
    with the six starting categories and no expenses.
    -- decided by: automated test, using a database file from before
    accounts, plus a manual check on `backend/expenses-login.db`.

## Known Limitations
- **No login.** The online app has no accounts or passwords. Anyone with
  the link can see, add, change, and delete all of its data, and everyone
  shares the same data. This is acceptable for a course demo only; real
  personal spending should not be entered online. (The login experiment
  is laptop-only and does not change the online app.)
- **Login experiment, for learning only:**
  - Nothing stops someone from guessing passwords many times.
  - The login token is kept in the browser's storage, where a harmful
    script on the page could read it. Fine for learning, not for real use.
  - A forgotten password can't be recovered; the account's data stays in
    the database but can't be reached from the page.
- **The free server sleeps.** After 15 minutes with no visitors, the
  backend sleeps, and the next visit takes about a minute while it wakes
  up.
- **Separate data.** The online app starts with an empty database (just
  the six starting categories). Data on the laptop and data online are
  separate, and neither is copied to the other.
- **No backups** are set up on the free plans.
- **Free-plan limits:** the online database holds at most 0.5 GB.

## Output Files
- backend/: the FastAPI application, database models, and tests.
- frontend/: the React screens.
- specs/: the specification files. These must not be changed by the agent
  unless explicitly asked.
- .github/workflows/: the GitHub Actions workflow that tests and deploys
  the app.
- The exact file structure is to be proposed in the implementation plan
  and reviewed before any code is written.

## Out of Scope
- Login extras: password reset or recovery, changing a username or
  password, deleting an account, "remember me", email addresses, limiting
  repeated login attempts, and sharing data between accounts.
- Deploying the login version online, or upgrading the online PostgreSQL
  database to it.
- Currencies other than Indian rupees.
- Charts and graphs. (Exception: a simple progress bar on each category card, showing how much of its limit is used, is allowed.)
- Bank or UPI connections.
- Receipt photos or scanning.
- Exporting to Excel or PDF.
- Any AI feature.