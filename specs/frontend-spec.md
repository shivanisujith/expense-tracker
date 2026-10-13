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
- **Card:** a box with rounded corners that groups related content.
- **Grid:** cards arranged in rows and columns.
- **Progress bar:** a horizontal bar that fills up to show how much of a
  limit has been used.
- **Popup (modal):** a box that opens on top of the page and must be
  closed before the rest of the page can be used again.
- **Icon button:** a small button showing a symbol (such as a pencil)
  instead of a word.
- **Toast:** a short message that pops up near the bottom of the screen
  for a few seconds, then disappears by itself.

## Screen layout
The app is **one page** laid out as a dashboard, with these parts:

1. **Page title**: "Expense Tracker", with a greeting and today's full
   date underneath, for example "Hi there, here's your spending ·
   Thursday, 8 October 2026". It sits directly on the pink page, with no
   bar or box behind it.
2. **Server banner**: hidden unless the server can't be reached.
3. **Add expense form**: one horizontal row across the full width.
4. Below the form, **two columns** side by side:
   - **Left (a bit more than half the width): one cream box** headed
     "This month: October 2026", with a **Manage categories** button,
     holding one card per category.
   - **Right: the Expenses box**, all expenses, newest first.

On a phone, these all stack into one column in the order above: page
title, banner, add form, category cards, expense list.

Editing an expense happens in a **popup**, not in the add form (see
section 3). Adding, renaming, and deleting categories happens in the
**Manage categories popup** (see section 5).

### Money and date display
- Money is shown in rupees with 2 decimals and Indian digit grouping, for
  example `Rs 1,25,000.50`. The frontend converts paise to rupees for
  display only.
- Dates are shown like `7 Oct 2026`.

---

## Visual design

### Overall style
- **Page background:** soft baby pink.
- **No white surfaces:** nothing on the page has a pure white
  background, because white does not match the pink and green.
- **No header bar:** the page title sits directly on the pink page, with
  no bar or box behind it.
- **Boxes:** soft cream, with rounded corners and a thin border so they
  stand out from the pink page. The add form, the category box, the
  Expenses box, and the edit popup are cream boxes.
- **Category cards and input fields:** a slightly lighter cream than the
  boxes, with a thin border, so they still stand out inside the boxes.
  Light (secondary) buttons, such as Cancel and Set limit, use the same
  lighter cream.
- **Accent colour:** sage green, used for buttons, links, and progress
  bars. No other accent colours. Buttons use a deep sage so the light
  cream text on them is easy to read.
- **Red:** used **only** for over-limit warnings and error messages
  (including the server banner and the delete confirmation). Nothing else
  is red.
- **Text colours:** deep plum shades that match the pink page, instead of
  near-black and grey:
  - **Main text** (titles, headings, amounts, category names): deep plum.
  - **Page subtitle** (the line under "Expense Tracker"): a slightly
    lighter plum.
  - **Secondary text** (dates, notes, "Rs X left", "No limit set", form
    labels, and placeholder text such as "Choose a category"): a softer,
    muted plum.
  - All three pass the readability rule on every background they can sit
    on: pink, cream, lighter cream, and the light red of an over-limit
    card (see the table below).

### Colours and contrast
- **Readability rule:** every colour pair must meet the WCAG AA contrast
  standard (a widely used accessibility guideline):
  - At least **4.5 : 1** for text, including text on buttons.
  - At least **3 : 1** for progress bars and borders that carry meaning
    (such as the over-limit border).
- **Palette:** these colours meet that rule (contrast measured against the
  colour each is used on):

| Use | Colour | Contrast |
|---|---|---|
| Page background (baby pink) | `#FBE4EC` | see the text colours below |
| Boxes (soft cream) | `#F8F1E3` | see the text colours below |
| Cards, inputs, light buttons (lighter cream) | `#FDF9F0` | see the text colours below |
| Main text (deep plum) | `#3D2133` | on pink: 11.9 : 1; cream: 12.8 : 1; lighter cream: 13.7 : 1; light red: 10.6 : 1 |
| Page subtitle (plum) | `#553047` | on pink: 9.2 : 1 (it only sits on pink; also passes on cream 9.8, lighter cream 10.5, light red 8.2) |
| Secondary text (muted plum) | `#6A5260` | on pink: 5.8 : 1; cream: 6.3 : 1; lighter cream: 6.7 : 1; light red: 5.2 : 1 |
| Sage: buttons, links, progress bar | `#4F6F52` | light cream text on it: 5.4 : 1; sage text on cream: 5.0 : 1, on lighter cream: 5.4 : 1 |
| Sage, darker (button hover) | `#3F5A42` | light cream text on it: 7.3 : 1 |
| Light cream text (on buttons) | `#FDF9F0` | see the sages above |
| Light sage (progress bar track, hover backgrounds) | `#E3EAE0` / `#EEF3EC` | sage bar on track: 4.6 : 1; sage text on hover background: 5.0 : 1 |
| Red: warning and error text, over-limit bar | `#B91C1C` | on light red: 4.8 : 1; on cream: 5.8 : 1; on lighter cream: 6.2 : 1; on pink: 5.4 : 1; light cream text on it: 6.2 : 1 |
| Red border (over-limit card) | `#DC2626` | against the cream box: 4.3 : 1 |
| Light red (over-limit card, banner, delete confirmation) | `#FBD5D5` | see the text colours above |

- The over-limit card's light red is deliberately stronger than a pale
  pink, so it is clearly different from the creams around it, not only
  through its red border and text.

- Small changes to these exact colours are fine during the build, as long
  as every pair still meets the readability rule.
- **Font:** Inter, loaded from Google Fonts. If it can't load (for
  example with no internet), the browser's normal system font is used and
  the page still works.
- **Less scrolling:** the page should look like a website dashboard, not
  a long document. On a laptop, the page title, add form, and the top of both
  columns (category cards and expense list) should fit on the first
  screen.
- **Use the screen width:** the page content is up to about 1400 pixels
  wide, with small margins (about 24 pixels) on each side, instead of a
  narrow centred column.

### Page columns
- On a laptop or wider screen (about 1000 pixels wide or more), the area
  below the add form is split into two columns:
  - **Left:** the category box (the "This month" heading and all the
    category cards), taking a bit more than half the width (about 55%).
  - **Right:** the Expenses box, taking the rest.
- The two boxes look even: their tops line up, and they use the same
  padding and the same heading style. Each box is as tall as its own
  content, so a long expense list does not stretch the category box.
- On narrower screens (tablets and phones), the two columns stack into
  one: the category box first, then the Expenses box.

### Page title
- The top of the page has no bar or box: two lines of text sit directly
  on the pink background, lined up with the left edge of the boxes below.
  - **Line 1:** "Expense Tracker" in large, bold text, in the main deep
    plum text colour.
  - **Line 2,** smaller, underneath: "Hi there, here's your spending · "
    followed by today's full date, for example "Hi there, here's your
    spending · Thursday, 8 October 2026" (weekday, day, month name, year).
    It uses the page subtitle plum.
- The date comes from the browser's own clock, so it shows even before
  the backend answers or when the server can't be reached.

### Category box and its "This month" heading
- One cream box holds the heading and one card per category. The
  loading, error, and Try again messages for the summary also appear
  inside this box.
- A **Manage categories** button (a light button) sits at the right end
  of the heading line. It opens the Manage categories popup. It is
  disabled until the summary has loaded, because the summary provides
  the list of categories.
- The box's heading is "This month: " followed by the month name and
  year, for example "This month: October 2026", styled like the
  "Expenses" heading in the box next to it.
- The month comes from the summary's `month` value (worked out by the
  backend in IST), so it always matches what the cards count. Until the
  summary has loaded, or if it can't be loaded, the heading reads just
  "This month".

### Category cards
- One card per current category, in category order: the starting six
  (Food, Transport, Shopping, Bills, Entertainment, Other) first, then
  new categories in the order they were added. A renamed category keeps
  its place.
- **Grid:** 2 cards per row in the left column on a laptop, 2 per row on
  a tablet-sized screen, 1 per row on a phone.
- Each card shows:
  - The **category name**.
  - **Spent of limit**, for example `Rs 3,200.00 of Rs 5,000.00`. With no
    limit set, just the spent amount, for example `Rs 3,200.00 spent`.
  - A **progress bar** showing spent as a share of the limit. It is
    filled in sage green on a light sage track, never more than full, and
    is only shown when a limit is set.
  - One status line:
    - `Rs X left` when a limit is set and not exceeded (including
      `Rs 0.00 left` when spent exactly equals the limit).
    - `No limit set` when there is no limit.
    - `Over limit by Rs X` when over the limit.
  - The **Set limit** (no limit yet) or **Change limit** button.
- **Over-limit card:** the card turns red: a thicker red border (2
  pixels instead of 1) and light red background, a full red progress bar,
  and the status line `Over limit by Rs X` in red bold text. It sits on
  the cream category box, not the pink page, so the red stands out
  clearly. The warning is always in words, not just colour.

### Add expense form
- The form runs across the **full width** of the page, above the two
  columns.
- On a laptop, all fields sit in **one horizontal row**, in this order:
  Amount, Category, Date, Note, then the **Add expense** button.
- The Category box starts empty, showing "Choose a category" in muted
  plum placeholder text.
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
- **Column headings:** above the rows, small headings "Date", "Category",
  "Note", and "Amount" in muted plum, each lined up with its column.
  "Amount" is right-aligned like the amounts. There is no heading above
  the icon buttons. The headings only show when there is at least one
  expense (not while loading, on an error, or when the list is empty).
- Rows stay on one line as long as the Expenses box is at least about
  420 pixels wide inside, which covers almost every laptop. Long notes
  wrap within the Note column.
- When the box is narrower than that (phones and small windows), each row
  wraps onto two lines (category and amount on top, date and note below),
  keeping the amount and icon buttons visible, and the column headings
  are hidden.
- The delete confirmation appears inside that expense's row (see
  section 4).

### Popup (edit expense)
- A cream box in the middle of the screen, over a darkened page. Its
  input fields are the lighter cream, like the add form's.
- Title "Edit expense", the four fields (Amount, Category, Date, Note)
  stacked one per line, then **Save changes** and **Cancel**.
- The Category box lists the current categories, in category order, and
  shows the expense's current category. It has no "Choose a category"
  option.
- While the popup is open, the page behind it can't be used.
- When it opens, the cursor goes to the Amount field.

### Popup (manage categories)
- Looks like the edit popup: a cream box in the middle of the screen,
  over a darkened page, with lighter cream input fields.
- Title "Manage categories", then:
  - The list of current categories, in category order. Each row shows the
    name and two small icon buttons: rename (pencil) and delete (bin).
    Their screen-reader labels and tooltips name the category, for
    example "Rename Food" and "Delete Food". If the list is too tall for
    the screen, it scrolls inside the popup.
  - Below the list: an "Add a category" text box with an **Add** button.
  - At the bottom: a **Close** button.
- When it opens, the cursor goes to the "Add a category" box.
- Error messages are red: under the add box for adding, inside the row
  for renaming and deleting, and at the top of the popup for messages
  that are not about one row.

### Success messages (toasts)
- A small sage green box with light cream text (5.4 : 1, the same pair as
  the buttons), with rounded corners and a soft shadow.
- It appears centred near the bottom of the screen, floating above the
  page, and is never wider than the screen.
- It does not block anything: clicks pass through it to the page, it
  never takes the cursor or keyboard focus, and it does not move anything
  else on the page.

### Narrow phone screens
- Everything stacks into **one column**, in this order: page title,
  banner, add form (fields stacked one per line with a full-width
  button), the category box (one card per row), and the Expenses box
  (each row wrapping so the amount and icon buttons stay visible).
- Nothing on the page needs sideways scrolling.

---

## 1. Category cards (this month's summary)

The category box, its "This month" heading, and the content of each card
are described under **Visual design** above. The month in the heading is
the current month (IST), and spent counts only that month's expenses.

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
- **Loading:** "Loading summary..." inside the category box, in place of
  the cards.
- **Empty:** none. Every current category always has a card (there is
  always at least one category), with Rs 0.00 spent if nothing was
  spent.
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
| Category | Drop-down of the current categories, in category order | none: shows "Choose a category" |
| Date     | Date picker, cannot pick a day after today | today |
| Note     | Text box, max 100 characters  | empty      |

Button: **Add expense**.

- The category list comes from the summary. Until the summary has loaded,
  the Category box offers only "Choose a category".
- If the category chosen in the add form is renamed or deleted (in the
  Manage categories popup), the Category box goes back to "Choose a
  category". The rest of the form keeps what was typed.

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
- **Can't reach server:** show the server banner (see section 6). Keep
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

## 5. Manage categories popup

How the popup looks is described under **Visual design**. The backend
checks every rule again; the frontend checks below are for convenience.

### Opening and closing
- **Manage categories** in the category box opens the popup.
- **Close** closes it. Pressing the Escape key does the same. Anything
  typed but not saved (a new name, or a rename in progress) is discarded.
- Clicking the darkened page behind the popup does **not** close it.
- While a change is being saved, Close and Escape do nothing until the
  answer comes back.

### Frontend checks for names (adding and renaming)
Spaces at the start and end are removed first. If a check fails, the
message shows and nothing is sent.
- Empty: "Please enter a category name."
- Over 30 characters: "Category name must be 30 characters or fewer."
- Same as another category's name, ignoring capital letters: "A category
  called Food already exists." (using the existing category's name).
  When renaming, the category's own name doesn't count, so changing only
  its capitals (for example "food" to "Food") is allowed.
- Adding when there are already 20 categories: "You can have at most 20
  categories."

### Adding
- Type a name in "Add a category" and click **Add** (or press Enter).
- **Saving:** Add shows "Saving..." and is disabled.
- **Success:** the box clears, and the new category appears at the end of
  the list and as a new card, with no limit.

### Renaming
- The **rename** icon turns that row into a text box filled with the
  current name, with **Save** and **Cancel**. Only one row can be renamed
  at a time; starting another rename cancels the first without saving.
- **Saving:** Save shows "Saving..." and is disabled.
- **Success:** the row shows the new name. Its card, the dropdowns, and
  every expense in the list (in every month) show the new name. Its limit
  and spent amount are unchanged.

### Deleting
- The **delete** icon asks, inside that row: "Delete Transport? This
  can't be undone." with **Delete** and **Cancel**.
- **Deleting:** Delete shows "Deleting..." and is disabled.
- **Success:** the row and its card disappear, together with its limit.
- **Refused because it is in use:** the backend's message shows in that
  row, for example "Can't delete Food: 4 expenses use it." Nothing
  changes.
- **Refused because it is the last category:** "You must keep at least
  one category." shows in that row.

### States (for adding, renaming, and deleting)
- **Refused by backend (422):** show the backend's `message` under the add
  box or in that row. Keep what was typed.
- **Not found (404):** show "This category no longer exists." at the top
  of the popup, and reload the list.
- **Server error (500):** show "Something went wrong on the server. Please
  try again." under the add box or in that row. Keep what was typed.
- **Can't reach server:** show "Can't reach the server. Check that the
  backend is running, then try again." at the top of the popup, and show
  the server banner on the page behind it. Keep what was typed.

After every successful add, rename, or delete, the popup's list, the
category cards, both category dropdowns, and the expense list reload from
the backend.

---

## 6. Can't reach the server (goal-spec acceptance criterion 8)

**When it applies:** any request to the backend gets no response, either
because the connection fails or because nothing comes back within 10
seconds. This covers loading the page, adding, editing, deleting,
setting limits, and adding, renaming, or deleting categories.

**What the user sees:**
- A red banner at the top of the page, just below the page title:
  **"Can't reach the server. Check that the backend is running, then
  try again."**
  with a **Try again** button.
- The rest of the page still shows: page title, form, and any cards or
  list already loaded. The page is never blank or broken, and no raw
  technical error text is shown.
- Anything the user had typed in the form, the edit popup, a limit box,
  or the Manage categories popup is kept.

**Try again:** reloads the cards and list. If both load, the banner
disappears. If the server still can't be reached, the banner stays.

**Manual check:** stop the backend, open or reload the page, and confirm
the banner shows instead of a blank page. Start the backend, click
**Try again**, and confirm the banner disappears and the data loads.

---

## 7. Success messages (toasts)

After every **successful** change, a toast shows one of these messages
for about 3 seconds:

| Change | Message |
|---|---|
| Adding an expense | Expense added |
| Saving changes to an expense | Expense updated |
| Deleting an expense | Expense deleted |
| Setting or changing a limit | Limit saved |
| Adding a category | Category added |
| Renaming a category | Category renamed |
| Deleting a category | Category deleted |

- **Only for success.** No toast appears when a change is refused, fails,
  or the server can't be reached; those keep showing their own messages
  as described above. Loading or reloading data never shows a toast.
- **One at a time.** If another change succeeds while a toast is showing,
  the new message replaces it and the 3 seconds start again.
- **Screen readers** announce each message politely (without interrupting
  what is being read), using a status area that is always present on the
  page.
- **While the Manage categories popup is open,** the darkened page behind
  it is hidden from screen readers, so category toasts appear and are
  announced from inside the popup, in the same place at the bottom of the
  screen. Closing the popup removes any toast that is still showing.

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
6. **Manage categories.** Click **Manage categories** in the category
   box. In the popup, add a category, rename one, or delete one that no
   expense uses. The cards, dropdowns, and expense list update. Close the
   popup.
7. **Reload the page** at any time. Everything saved is still there,
   because the data lives in the backend.

After every successful add, edit, delete, limit change, or category
change, the frontend reloads both the list and the cards from the
backend. It does not work out totals itself.
