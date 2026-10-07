# Expense Tracker -- Frontend Specification

Source of truth: `specs/goal-spec.md`. Requests and responses are defined
in `specs/api-contract-spec.md`. The backend enforces every rule. The
frontend checks below are only for convenience.

## Plain-language terms
- **Frontend:** the React page the user sees in the browser.
- **Loading state:** what shows while waiting for the backend to answer.
- **Empty state:** what shows when there is nothing to list yet.
- **Error state:** what shows when something went wrong.
- **Banner:** a coloured message strip across the top of the page.

## Screen layout
The app is **one page** with these parts, top to bottom:

1. **Header**: the title "Expense Tracker".
2. **Server banner**: hidden unless the server can't be reached.
3. **Expense form**: add an expense, or edit one.
4. **This month's summary**: one row per category.
5. **Expense list**: all expenses, newest first.

### Money and date display
- Money is shown in rupees with 2 decimals and Indian digit grouping, for
  example `Rs 1,25,000.50`. The frontend converts paise to rupees for
  display only.
- Dates are shown like `7 Oct 2026`.

---

## 1. Expense form

### Fields
| Field    | Input                         | Default    |
|----------|-------------------------------|------------|
| Amount   | Text box for rupees, e.g. 12.50 | empty    |
| Category | Drop-down of the six categories | Food     |
| Date     | Date picker, cannot pick a day after today | today |
| Note     | Text box, max 100 characters  | empty      |

Buttons: **Add expense**. In edit mode: **Save changes** and **Cancel**.

### Frontend checks before sending
If one fails, show the message under that field and send nothing.
- Amount empty: "Please enter an amount."
- Amount not a number: "Amount must be a number, like 12.50."
- Amount 0 or less: "Amount must be greater than 0."
- Amount with more than 2 decimal places: "Amount can have at most 2
  decimal places."
- Date empty: "Please choose a date."
- Date after today: "Date cannot be in the future."
- Note over 100 characters: "Note must be 100 characters or fewer."

When the checks pass, the amount is converted from rupees to whole paise
(12.50 becomes 1250) and sent.

### States
- **Saving:** the button shows "Saving..." and is disabled, so the
  expense can't be sent twice.
- **Success (add):** the form clears back to its defaults (date = today).
  The list and summary reload.
- **Success (edit):** the form leaves edit mode and clears. The list and
  summary reload.
- **Refused by backend (422):** show the backend's `message` under the
  field named in `field`, or above the form if `field` is null. Keep
  everything the user typed.
- **Not found (404, during edit):** show "This expense no longer exists."
  above the form, leave edit mode, and reload the list and summary.
- **Server error (500):** show "Something went wrong on the server. Please
  try again." above the form. Keep everything the user typed.
- **Can't reach server:** show the server banner (see below). Keep
  everything the user typed.

### Edit mode
- Clicking **Edit** on an expense fills the form with that expense's
  values. The heading changes to "Edit expense" and the buttons change to
  **Save changes** and **Cancel**.
- **Cancel** clears the form and returns to add mode without saving.

---

## 2. This month's summary

A heading showing the month, for example "October 2026", then six rows in
the fixed order: Food, Transport, Shopping, Bills, Entertainment, Other.

Each row shows:
- Category name.
- **Spent** this month.
- **Limit**, or "No limit set".
- **Remaining**, or "-" when no limit is set.
- A **Set limit** button (no limit yet) or **Change limit** button.

### Over-limit warning
When `over_limit` is true, the row is highlighted in red and shows:
"Over limit by Rs X", where X is how far over (spent minus limit).
"Remaining" is not shown as a negative number. The warning text is shown
in words, not just colour.

### Setting a limit
- Clicking **Set limit** / **Change limit** shows a small amount box and
  **Save** / **Cancel** buttons inside that row. The box is filled with
  the current limit if there is one.
- Same amount checks as the expense form (not empty, a number, more
  than 0, at most 2 decimals).
- **Saving:** Save button shows "Saving..." and is disabled.
- **Success:** the box closes and the summary reloads.
- **Refused (422) / server error (500):** show the message under the box,
  keep the box open with what was typed.
- **Can't reach server:** show the server banner, keep the box open.

### States
- **Loading:** "Loading summary..." in place of the rows.
- **Empty:** none. All six categories always show, with Rs 0.00 spent if
  nothing was spent.
- **Error (500):** "Couldn't load the summary. Please try again." with a
  **Try again** button.
- **Can't reach server:** the server banner shows. The summary area shows
  nothing extra.

---

## 3. Expense list

All expenses from every month, newest first, in the order the backend
returns them. Each item shows date, category, amount, note (if any), and
**Edit** and **Delete** buttons.

### Deleting
- Clicking **Delete** asks: "Delete this expense? This can't be undone."
  with **Delete** and **Cancel**.
- **Delete** removes the expense, then the list and summary reload.
- If the expense was being edited in the form, the form returns to add
  mode.
- **Not found (404):** show "This expense no longer exists." and reload
  the list and summary.
- **Server error (500):** show "Couldn't delete. Please try again."
- **Can't reach server:** show the server banner.

### States
- **Loading:** "Loading expenses..." in place of the list.
- **Empty:** "No expenses yet. Add your first one above."
- **Error (500):** "Couldn't load your expenses. Please try again." with a
  **Try again** button.
- **Can't reach server:** the server banner shows. The list area shows
  nothing extra.

---

## 4. Can't reach the server (goal-spec acceptance criterion 8)

**When it applies:** any request to the backend gets no response, either
because the connection fails or because nothing comes back within 10
seconds. This covers loading the page, adding, editing, deleting, and
setting limits.

**What the user sees:**
- A red banner at the top of the page:
  **"Can't reach the server. Check that the backend is running, then
  try again."**
  with a **Try again** button.
- The rest of the page still shows: header, form, and any summary or
  list already loaded. The page is never blank or broken, and no raw
  technical error text is shown.
- Anything the user had typed in the form or limit box is kept.

**Try again:** reloads the summary and list. If both load, the banner
disappears. If the server still can't be reached, the banner stays.

**Manual check:** stop the backend, open or reload the page, and confirm
the banner shows instead of a blank page. Start the backend, click
**Try again**, and confirm the banner disappears and the data loads.

---

## User flow
1. **Open the page.** The summary and list show their loading states, then
   their data (or the empty/error/server states above).
2. **Add an expense.** Fill the form, click **Add expense**. The list and
   summary update. If the category is now over its limit, its row shows
   the over-limit warning. The expense is still saved.
3. **Edit an expense.** Click **Edit** on a list item, change fields, click
   **Save changes**. The list and summary update.
4. **Delete an expense.** Click **Delete**, confirm. The list and summary
   update.
5. **Set a limit.** Click **Set limit** on a summary row, enter an amount,
   click **Save**. The row updates with limit, remaining, and any warning.
6. **Reload the page** at any time. Everything saved is still there,
   because the data lives in the backend.

After every successful add, edit, delete, or limit change, the frontend
reloads both the list and the summary from the backend. It does not work
out totals itself.
