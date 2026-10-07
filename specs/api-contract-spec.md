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
- Category values are exactly: `"Food"`, `"Transport"`, `"Shopping"`,
  `"Bills"`, `"Entertainment"`, `"Other"`.
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
checking in this order: amount_paise, category, date, note.

### All error codes
| Status | code              | field          | message                                          |
|--------|-------------------|----------------|--------------------------------------------------|
| 422    | invalid_amount    | amount_paise   | Amount is required and must be a whole number of paise greater than 0. |
| 422    | invalid_category  | category       | Category must be one of: Food, Transport, Shopping, Bills, Entertainment, Other. |
| 422    | invalid_date      | date           | Date is required and must be a real date in YYYY-MM-DD form. |
| 422    | future_date       | date           | Date cannot be in the future.                    |
| 422    | note_too_long     | note           | Note must be 100 characters or fewer.            |
| 422    | invalid_limit     | limit_paise    | Limit is required and must be a whole number of paise greater than 0. |
| 422    | invalid_request   | null           | The request could not be read. Please try again. |
| 404    | expense_not_found | null           | This expense no longer exists.                   |
| 500    | server_error      | null           | Something went wrong on the server. Please try again. |

`invalid_request` is used when the body is not valid JSON or is not a
JSON object.

---

## Endpoints

### 1. List expenses
`GET /api/expenses`

Returns all expenses, newest date first. Same date: most recently saved
first.

**200 OK**
```json
[
  {"id": 8, "amount_paise": 50000, "category": "Bills", "date": "2026-10-07", "note": ""},
  {"id": 7, "amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"},
  {"id": 3, "amount_paise": 9900, "category": "Shopping", "date": "2026-09-28", "note": "Socks"}
]
```
No expenses: `[]`.

Errors: 500 only.

### 2. Add an expense
`POST /api/expenses`

**Request body**
```json
{"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
```
`note` may be left out.

**201 Created**: the saved expense object, including its new `id`.

**Errors**
- 422 with `invalid_amount`, `invalid_category`, `invalid_date`,
  `future_date`, `note_too_long`, or `invalid_request`.
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

Always returns all six categories in the fixed order. "Current month" is
worked out in IST.

**200 OK**
```json
{
  "month": "2026-10",
  "categories": [
    {"category": "Food",          "spent_paise": 1250,  "limit_paise": 500000, "remaining_paise": 498750, "over_limit": false},
    {"category": "Transport",     "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category": "Shopping",      "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category": "Bills",         "spent_paise": 50000, "limit_paise": 40000,  "remaining_paise": -10000, "over_limit": true},
    {"category": "Entertainment", "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false},
    {"category": "Other",         "spent_paise": 0,     "limit_paise": null,   "remaining_paise": null,   "over_limit": false}
  ]
}
```
- `limit_paise` and `remaining_paise` are `null` when no limit is set.
- `remaining_paise` is negative when over the limit.
- `over_limit` is true only when spent is more than the limit.

Errors: 500 only.

### 6. Set or change a category limit
`PUT /api/limits/{category}` (for example `/api/limits/Food`)

**Request body**
```json
{"limit_paise": 500000}
```

**200 OK**
```json
{"category": "Food", "limit_paise": 500000}
```

**Errors**
- 422 `invalid_category` if the category in the address is not one of the
  six (for example `/api/limits/Travel`).
- 422 `invalid_limit` or `invalid_request`.
- 500 `server_error`.

There is no endpoint to remove a limit.

---

## When the backend can't be reached
If the backend is stopped or unreachable, there is no response at all, so
there is no status code or error object. The frontend must treat "no
response within 10 seconds" or "connection failed" as **can't reach the
server** (see `specs/frontend-spec.md`).
