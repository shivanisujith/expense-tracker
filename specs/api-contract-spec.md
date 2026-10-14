# Expense Tracker -- API Contract Specification

Source of truth: `specs/goal-spec.md`. The rules behind these responses are
in `specs/backend-spec.md`. How the frontend uses them is in
`specs/frontend-spec.md`.

## Plain-language terms
- **API:** the agreed way the frontend and backend talk to each other.
- **Endpoint:** one address the frontend can send requests to, like
  `/api/expenses`.
- **Method:** what kind of request it is. GET = read, POST = create,
  PUT = replace/set, DELETE = remove.
- **Request body / response body:** the data sent along with a request or
  sent back in a response. Written in **JSON**, a simple text format of
  names and values, like `{"amount_paise": 1250}`.
- **Status code:** a number in every response saying how it went.
  - 200 OK: worked, and here is the data.
  - 201 Created: a new item was saved.
  - 204 No Content: worked, nothing to send back (used for delete).
  - 404 Not Found: that item does not exist.
  - 422 Unprocessable: your input broke a rule; nothing was saved.
  - 500 Server Error: something went wrong inside the backend.

## General rules
- All endpoints start with `/api`.
- All bodies are JSON.
- Money is always a whole number of paise (`1250` means Rs 12.50).
- Dates are always text in `YYYY-MM-DD` form, like `"2026-10-07"`.
- Months are always text in `YYYY-MM` form, like `"2026-09"`.
- **Query parameter:** an extra setting added to the end of an address
  after a `?`, like `/api/expenses?month=2026-09`.
- In expenses, `category` is the category's **name**, exactly as it is
  currently spelled, including capital letters (for example `"Food"`).
  The current names come from the summary (endpoint 5).
- Category endpoints (setting a limit, renaming, deleting) identify a
  category by its **id**, a whole number that never changes, so any
  characters in a name are safe.
- Extra fields the frontend sends that are not listed here are ignored.

## The expense object
Every response that includes an expense uses this shape:

```json
{
  "id": 7,
  "amount_paise": 1250,
  "category": "Food",
  "date": "2026-10-07",
  "note": "Lunch"
}
```

`note` is always text and is `""` when there is no note.

## The error object
Every error response (404, 422, 500) uses this shape:

```json
{
  "error": {
    "code": "invalid_amount",
    "message": "Amount must be greater than 0.",
    "field": "amount_paise"
  }
}
```

- `code`: short fixed name the frontend can check.
- `message`: plain-English text, safe to show to the user as is.
- `field`: which input failed, or `null` if it isn't about one field.

If more than one field is wrong, the backend reports the first one found,
checking in this order: amount_paise, category, date, note. For category
endpoints the order is in `specs/backend-spec.md` (rule 21).

### All error codes
| Status | code              | field          | message                                          |
|--------|-------------------|----------------|--------------------------------------------------|
| 422    | invalid_amount    | amount_paise   | Amount is required and must be a whole number of paise greater than 0. |
| 422    | amount_too_large  | amount_paise   | Amount is too large.                             |
| 422    | invalid_category  | category       | Category must be one of your categories. |
| 422    | invalid_date      | date           | Date is required and must be a real date in YYYY-MM-DD form. |
| 422    | future_date       | date           | Date cannot be in the future.                    |
| 422    | note_too_long     | note           | Note must be 100 characters or fewer.            |
| 422    | invalid_limit     | limit_paise    | Limit is required and must be a whole number of paise greater than 0. |
| 422    | limit_too_large   | limit_paise    | Limit is too large.                              |
| 422    | category_name_missing   | name | Please enter a category name. |
| 422    | category_name_too_long  | name | Category name must be 30 characters or fewer. |
| 422    | duplicate_category      | name | A category called Food already exists. (uses the existing category's name, as stored) |
| 422    | too_many_categories     | null | You can have at most 20 categories. |
| 422    | category_in_use         | null | Can't delete Food: 4 expenses use it. (exactly one: "Can't delete Food: 1 expense uses it.") |
| 422    | last_category           | null | You must keep at least one category. |
| 422    | invalid_month     | month          | Month must be a real month in YYYY-MM form. |
| 422    | future_month      | month          | Month cannot be in the future.                   |
| 422    | invalid_request   | null           | The request could not be read. Please try again. |
| 404    | expense_not_found | null           | This expense no longer exists.                   |
| 404    | category_not_found | null          | This category no longer exists.                  |
| 500    | server_error      | null           | Something went wrong on the server. Please try again. |

`invalid_request` is used when the body is not valid JSON or is not a
JSON object, when an id in the address is not a whole number, or when a
note is given but is not text.

Requests that send a body must say it is JSON (the
`Content-Type: application/json` header). A body sent without it, or
labelled as something else, is refused with `invalid_request`, even if
its text is valid JSON.

The largest allowed amount or limit is `10000000000` paise
(Rs 10,00,00,000.00). Above that, `amount_too_large` or
`limit_too_large` is returned.

---

## Endpoints

### 1. List expenses
`GET /api/expenses` (all months) or `GET /api/expenses?month=2026-09`
(one month)

Returns all expenses, or with `month` only the expenses whose date is in
that month. Newest date first. Same date: most recently saved first.

**200 OK**
```json
[
  {"id": 8, "amount_paise": 50000, "category": "Bills", "date": "2026-10-07", "note": ""},
  {"id": 7, "amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"},
  {"id": 3, "amount_paise": 9900, "category": "Shopping", "date": "2026-09-28", "note": "Socks"}
]
```
No expenses (in that month): `[]`. A month after the current one is
allowed and gives `[]`.

**Errors**
- 422 `invalid_month` if `month` is given but is not a real month in
  `YYYY-MM` form (including `?month=` with nothing after it). Example:
  ```json
  {"error": {"code": "invalid_month", "message": "Month must be a real month in YYYY-MM form.", "field": "month"}}
  ```
- 500 `server_error`.

### 2. Add an expense
`POST /api/expenses`

**Request body**
```json
{"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
```
`note` may be left out.

**201 Created**: the saved expense object, including its new `id`.

**Errors**
- 422 with `invalid_amount`, `amount_too_large`, `invalid_category`,
  `invalid_date`, `future_date`, `note_too_long`, or `invalid_request`.
  Example (amount 0):
  ```json
  {"error": {"code": "invalid_amount", "message": "Amount is required and must be a whole number of paise greater than 0.", "field": "amount_paise"}}
  ```
- 500 `server_error`.

Going over a limit is **not** an error: the expense is saved with 201.
The warning appears in the summary (endpoint 5).

### 3. Edit an expense
`PUT /api/expenses/{id}` (for example `/api/expenses/7`)

**Request body**: same as Add. All of amount, category and date must be
sent. The whole expense is replaced.

**200 OK**: the updated expense object.

**Errors**
- 404 `expense_not_found` if no expense has that id.
- 422: same codes as Add.
- 500 `server_error`.

### 4. Delete an expense
`DELETE /api/expenses/{id}`

**204 No Content**: deleted. No body.

**Errors**
- 404 `expense_not_found` if no expense has that id.
- 500 `server_error`.

### 5. Category summary for the current month
`GET /api/summary`

Always returns every current category, in category order (see
`specs/backend-spec.md`). This is also how the frontend gets the current
list of categories for its dropdowns, cards, and the Manage categories
popup. "Current month" is worked out in IST.

**200 OK**
```json
{
  "month": "2026-10",
  "total_spent_paise": 51250,
  "categories": [
    {"category_id": 1, "category": "Food",          "spent_paise": 1250,  "limit_paise": 500000, "remaining_paise": 498750, "over_limit": false},
    {"category_id": 2, "category": "Transport",     "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category_id": 3, "category": "Shopping",      "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category_id": 4, "category": "Bills",         "spent_paise": 50000, "limit_paise": 40000,  "remaining_paise": -10000, "over_limit": true},
    {"category_id": 5, "category": "Entertainment", "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category_id": 6, "category": "Other",         "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category_id": 7, "category": "Pets",          "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false}
  ]
}
```
- `limit_paise` and `remaining_paise` are `null` when no limit is set.
- `remaining_paise` is negative when over the limit.
- `over_limit` is true only when spent is more than the limit.
- `total_spent_paise` is everything spent in the current month across all
  categories, in whole paise (here 1250 + 50000 = 51250). It is 0 when
  nothing was spent this month.

Errors: 500 only.

### 6. Set or change a category limit
`PUT /api/categories/{id}/limit` (for example `/api/categories/1/limit`)

This replaces the old `PUT /api/limits/{category}`, which put the
category's name in the address.

**Request body**
```json
{"limit_paise": 500000}
```

**200 OK**
```json
{"category_id": 1, "category": "Food", "limit_paise": 500000}
```

**Errors**
- 404 `category_not_found` if no category has that id.
- 422 `invalid_limit`, `limit_too_large`, or `invalid_request`.
- 500 `server_error`.

There is no endpoint to remove a limit on its own. Deleting a category
(endpoint 9) removes its limit.

### 7. Add a category
`POST /api/categories`

**Request body**
```json
{"name": "Pets"}
```

**201 Created**
```json
{"id": 7, "name": "Pets"}
```
The name is saved with spaces at the start and end removed. The new
category goes at the end of the category order, with no limit.

**Errors**
- 422 `category_name_missing`, `category_name_too_long`,
  `duplicate_category`, `too_many_categories`, or `invalid_request`.
  Example (typing "food" when "Food" exists):
  ```json
  {"error": {"code": "duplicate_category", "message": "A category called Food already exists.", "field": "name"}}
  ```
- 500 `server_error`.

### 8. Rename a category
`PUT /api/categories/{id}` (for example `/api/categories/1`)

**Request body**
```json
{"name": "Groceries"}
```

**200 OK**
```json
{"id": 1, "name": "Groceries"}
```
The category keeps its id, its place in the order, its expenses, and its
limit. From now on, its expenses show the new name.

**Errors**
- 404 `category_not_found` if no category has that id.
- 422 `category_name_missing`, `category_name_too_long`,
  `duplicate_category`, or `invalid_request`. Renaming a category to its
  own name with different capitals is allowed.
- 500 `server_error`.

### 9. Delete a category
`DELETE /api/categories/{id}`

**204 No Content**: deleted, together with its limit if it had one. No
body.

**Errors**
- 404 `category_not_found` if no category has that id.
- 422 `last_category` if it is the only category left.
- 422 `category_in_use` if any expense, in any month, uses it. Example:
  ```json
  {"error": {"code": "category_in_use", "message": "Can't delete Food: 4 expenses use it.", "field": null}}
  ```
- 500 `server_error`.

### 10. Months with expenses
`GET /api/months`

Every month in which at least one expense is dated, once each, newest
first. The last one is the month of the earliest expense.

**200 OK**
```json
["2026-10", "2026-09", "2026-07"]
```
No expenses: `[]`.

Errors: 500 only.

### 11. Total for one month
`GET /api/months/{month}/total` (for example `/api/months/2026-09/total`)

The total spent in that month across all categories, counting expenses by
their date. Works for the current month and any earlier month.

**200 OK**
```json
{"month": "2026-09", "total_spent_paise": 9210}
```
`total_spent_paise` is 0 when nothing was spent that month. For the
current month it equals the summary's `total_spent_paise`.

**Errors**
- 422 `invalid_month` if the month is not a real month in `YYYY-MM` form.
- 422 `future_month` if the month is after the current month (IST).
  Example:
  ```json
  {"error": {"code": "future_month", "message": "Month cannot be in the future.", "field": "month"}}
  ```
- 500 `server_error`.

---

## When the backend can't be reached
If the backend is stopped or unreachable, there is no response at all, so
there is no status code or error object. The frontend must treat "no
response within 10 seconds" or "connection failed" as **can't reach the
server** (see `specs/frontend-spec.md`).
