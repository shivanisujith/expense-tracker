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
- **Card:** a white box with rounded corners that groups related content.
- **Grid:** cards arranged in rows and columns.
- **Progress bar:** a horizontal bar that fills up to show how much of a
  limit has been used.
- **Popup (modal):** a box that opens on top of the page and must be
  closed before the rest of the page can be used again.
- **Icon button:** a small button showing a symbol (such as a pencil)
  instead of a word.

## Screen layout
The app is **one page** laid out as a dashboard, with these parts:

1. **Header bar**: the app name "Expense Tracker" and today's full date,
   for example "Thursday, 8 October 2026".
2. **Server banner**: hidden unless the server can't be reached.
3. **Add expense form**: one horizontal row across the full width.
4. Below the form, **two columns** side by side:
   - **Left (a bit more than half the width): category cards**, under a
     small label such as "This month: October 2026".
   - **Right: expense list**, all expenses, newest first.

On a phone, these all stack into one column in the order above: header
bar, banner, add form, category cards, expense list.

Editing an expense happens in a **popup**, not in the add form (see
section 3).

### Money and date display
- Money is shown in rupees with 2 decimals and Indian digit grouping, for
  example `Rs 1,25,000.50`. The frontend converts paise to rupees for
  display only.
- Dates are shown like `7 Oct 2026`.

---

## Visual design

### Overall style
- **Page background:** light grey.
- **Cards:** white, with rounded corners and a thin border or soft shadow.
  Category cards, the add form, and the expense list each sit on a card.
- **Accent colour:** one calm blue, used for buttons, progress bars, and
  links. No other accent colours.
- **Red:** used **only** for over-limit warnings and error messages
  (including the server banner and the delete confirmation). Nothing else
  is red.
- **Font:** Inter, loaded from Google Fonts. If it can't load (for
  example with no internet), the browser's normal system font is used and
  the page still works.
- **Less scrolling:** the page should look like a website dashboard, not
  a long document. On a laptop, the header, add form, and the top of both
  columns (category cards and expense list) should fit on the first
  screen.
- **Use the screen width:** the page content is up to about 1400 pixels
  wide, with small margins (about 24 pixels) on each side, instead of a
  narrow centred column.

### Page columns
- On a laptop or wider screen (about 1000 pixels wide or more), the area
  below the add form is split into two columns:
  - **Left:** the "This month" label and the category cards, taking a
    bit more than half the width (about 55%).
  - **Right:** the expense list, taking the rest.
- On narrower screens (tablets and phones), the two columns stack into
  one: the category cards first, then the expense list.

### Header bar
- A full-width bar across the top with "Expense Tracker" on the left and
  today's full date on the right, for example "Thursday, 8 October 2026"
  (weekday, day, month name, year).
- The date comes from the browser's own clock, so it shows even before
  the backend answers or when the server can't be reached.

### "This month" label
- A small label just above the category cards: "This month: " followed
  by the month name and year, for example "This month: October 2026".
- The month comes from the summary's `month` value (worked out by the
  backend in IST), so it always matches what the cards count. The label
  appears once the summary has loaded, and is hidden while loading or if
  the summary can't be loaded.

### Category cards
- Six cards in the fixed order: Food, Transport, Shopping, Bills,
  Entertainment, Other.
- **Grid:** 2 cards per row in the left column on a laptop, 2 per row on
  a tablet-sized screen, 1 per row on a phone.
- Each card shows:
  - The **category name**.
  - **Spent of limit**, for example `Rs 3,200.00 of Rs 5,000.00`. With no
    limit set, just the spent amount, for example `Rs 3,200.00 spent`.
  - A **progress bar** showing spent as a share of the limit. It is
    filled in blue, never more than full, and is only shown when a limit
    is set.
  - One status line:
    - `Rs X left` when a limit is set and not exceeded (including
      `Rs 0.00 left` when spent exactly equals the limit).
    - `No limit set` when there is no limit.
    - `Over limit by Rs X` when over the limit.
  - The **Set limit** (no limit yet) or **Change limit** button.
- **Over-limit card:** the card turns red: red border and light red
  background, a full red progress bar, and the status line
  `Over limit by Rs X` in red bold text. The warning is always in words,
  not just colour.

### Add expense form
- The form runs across the **full width** of the page, above the two
  columns.
- On a laptop, all fields sit in **one horizontal row**, in this order:
  Amount, Category, Date, Note, then the **Add expense** button.
- The Category box starts empty, showing "Choose a category" in grey
  placeholder text.
- Each field keeps a visible label above it.
- Error messages appear **just below the row**, each one naming its field
  (for example "Amount: Please enter an amount.").
- Messages that are not about one field (server error, not found) appear
  in the same place below the row.

### Expense list
- Each expense is one clean row showing, left to right: **date**,
  **category**, **note** (blank if none), **amount** (right-aligned), and
  two small **icon buttons**: edit (pencil) and delete (bin).
- The icon buttons have text labels for screen readers ("Edit expense",
  "Delete expense") and show the same words as a tooltip on hover.
- Rows are separated by thin lines. No other decoration.
- When the list's column is too narrow to fit everything on one line,
  each row may wrap onto two lines (for example category and amount on
  top, date and note below), keeping the amount and icon buttons visible.
- The delete confirmation appears inside that expense's row (see
  section 4).

### Popup (edit expense)
- A white card in the middle of the screen, over a darkened page.
- Title "Edit expense", the four fields (Amount, Category, Date, Note)
  stacked one per line, then **Save changes** and **Cancel**.
- The Category box shows the expense's current category. It has no
  "Choose a category" option.
- While the popup is open, the page behind it can't be used.
- When it opens, the cursor goes to the Amount field.

### Narrow phone screens
- Everything stacks into **one column**, in this order: header bar,
  banner, add form (fields stacked one per line with a full-width
  button), "This month" label and category cards (one card per row), and
  the expense list (each row wrapping so the amount and icon buttons stay
  visible).
- Nothing on the page needs sideways scrolling.

---

## 1. Category cards (this month's summary)

The content of each card and the "This month" label above them are
described under **Visual design** above. The month in the label is the
current month (IST), and spent counts only that month's expenses.

### Setting a limit
- Clicking **Set limit** / **Change limit** shows a small amount box and
  **Save** / **Cancel** buttons inside that card. The box is filled with
  the current limit if there is one.
- Same amount checks as the expense form (not empty, a number, more
  than 0, at most 2 decimals).
- **Saving:** Save button shows "Saving..." and is disabled.
- **Success:** the box closes and the cards reload.
- **Refused (422) / server error (500):** show the message under the box,
  keep the box open with what was typed.
- **Can't reach server:** show the server banner, keep the box open.

### States
- **Loading:** "Loading summary..." in place of the cards.
- **Empty:** none. All six cards always show, with Rs 0.00 spent if
  nothing was spent.
- **Error (500):** "Couldn't load the summary. Please try again." with a
  **Try again** button.
- **Can't reach server:** the server banner shows. The cards area shows
  nothing extra.

---

## 2. Add expense form

The form is always in add mode. It is never used for editing.

### Fields
| Field    | Input                         | Default    |
|----------|-------------------------------|------------|
| Amount   | Text box for rupees, e.g. 12.50 | empty    |
| Category | Drop-down of the six categories | none: shows "Choose a category" |
| Date     | Date picker, cannot pick a day after today | today |
| Note     | Text box, max 100 characters  | empty      |

Button: **Add expense**.

### Frontend checks before sending
If one fails, show its message below the form row and send nothing. The
same checks and messages are used in the edit popup.
- Amount empty: "Please enter an amount."
- Amount not a number: "Amount must be a number, like 12.50."
- Amount 0 or less: "Amount must be greater than 0."
- Amount with more than 2 decimal places: "Amount can have at most 2
  decimal places."
- Category not chosen: "Please choose a category." (Below the row this
  reads "Category: Please choose a category.") Only the add form can
  have no category; the edit popup always has one.
- Date empty: "Please choose a date."
- Date after today: "Date cannot be in the future."
- Note over 100 characters: "Note must be 100 characters or fewer."

When the checks pass, the amount is converted from rupees to whole paise
(12.50 becomes 1250) and sent.

### States
- **Saving:** the button shows "Saving..." and is disabled, so the
  expense can't be sent twice.
- **Success:** the form clears back to its defaults (amount and note
  empty, category back to "Choose a category", date = today). The list
  and cards reload.
- **Refused by backend (422):** show the backend's `message` below the
  row, labelled with the field named in `field`, or on its own if `field`
  is null. Keep everything the user typed.
- **Server error (500):** show "Something went wrong on the server. Please
  try again." below the row. Keep everything the user typed.
- **Can't reach server:** show the server banner (see section 5). Keep
  everything the user typed.

---

## 3. Edit expense popup

### Opening and closing
- Clicking the **edit** icon on an expense opens the popup, filled with
  that expense's values.
- **Cancel** closes the popup without saving. Pressing the Escape key
  does the same.
- Clicking the darkened page behind the popup does **not** close it, so
  typed changes are not lost by accident.
- While saving, Cancel and Escape do nothing until the answer comes back.
- The add form is not affected by opening, using, or closing the popup.

### Checks
The same frontend checks and messages as the add form (section 2). Each
message appears under its field inside the popup.

### States
- **Saving:** **Save changes** shows "Saving..." and is disabled.
- **Success:** the popup closes. The list and cards reload.
- **Refused by backend (422):** show the backend's `message` under the
  field named in `field`, or at the top of the popup if `field` is null.
  Keep everything the user typed.
- **Not found (404):** show "This expense no longer exists." at the top
  of the popup. The fields and **Save changes** are disabled, and
  **Cancel** changes to **Close**. The list and cards reload behind the
  popup.
- **Server error (500):** show "Something went wrong on the server. Please
  try again." at the top of the popup. Keep everything the user typed.
- **Can't reach server:** show "Can't reach the server. Check that the
  backend is running, then try again." at the top of the popup, and show
  the server banner on the page behind it. The popup stays open with
  everything the user typed, so they can try **Save changes** again.

---

## 4. Expense list

All expenses from every month, newest first, in the order the backend
returns them. How each row looks is described under **Visual design**.

### Deleting
- Clicking the **delete** icon asks, inside that row: "Delete this
  expense? This can't be undone." with **Delete** and **Cancel**.
- **Delete** removes the expense, then the list and cards reload.
- **Not found (404):** show "This expense no longer exists." and reload
  the list and cards.
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

## 5. Can't reach the server (goal-spec acceptance criterion 8)

**When it applies:** any request to the backend gets no response, either
because the connection fails or because nothing comes back within 10
seconds. This covers loading the page, adding, editing, deleting, and
setting limits.

**What the user sees:**
- A red banner at the top of the page, just below the header bar:
  **"Can't reach the server. Check that the backend is running, then
  try again."**
  with a **Try again** button.
- The rest of the page still shows: header bar, form, and any cards or
  list already loaded. The page is never blank or broken, and no raw
  technical error text is shown.
- Anything the user had typed in the form, the edit popup, or a limit box
  is kept.

**Try again:** reloads the cards and list. If both load, the banner
disappears. If the server still can't be reached, the banner stays.

**Manual check:** stop the backend, open or reload the page, and confirm
the banner shows instead of a blank page. Start the backend, click
**Try again**, and confirm the banner disappears and the data loads.

---

## User flow
1. **Open the page.** The cards and list show their loading states, then
   their data (or the empty/error/server states above).
2. **Add an expense.** Fill the form row (including choosing a
   category), click **Add expense**. The list
   and cards update. If the category is now over its limit, its card turns
   red with the over-limit warning. The expense is still saved.
3. **Edit an expense.** Click the **edit** icon on a list row. The popup
   opens. Change fields, click **Save changes**. The popup closes and the
   list and cards update.
4. **Delete an expense.** Click the **delete** icon, confirm. The list and
   cards update.
5. **Set a limit.** Click **Set limit** on a category card, enter an
   amount, click **Save**. The card updates with its limit, progress bar,
   and status line.
6. **Reload the page** at any time. Everything saved is still there,
   because the data lives in the backend.

After every successful add, edit, delete, or limit change, the frontend
reloads both the list and the cards from the backend. It does not work
out totals itself.
