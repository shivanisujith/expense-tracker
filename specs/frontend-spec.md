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
- **Success message:** a short message such as "Expense added" that
  appears inside the box where the change was made, for a few seconds,
  then disappears by itself.
- **Token:** the long random pass the backend gives after signing up or
  logging in. The page sends it with every request to prove who is
  logged in.
- **localStorage:** a small storage area the browser keeps for each site,
  which survives reloading the page.

## Where the page runs
- **On the laptop:** `npm run dev` serves it at `http://localhost:5173`,
  and it talks to the backend at `http://localhost:8000/api`.
- **Online:** GitHub Pages serves it at
  `https://shivanisujith.github.io/expense-tracker/` (so all of its files
  live under `/expense-tracker/`), and it talks to the backend on Render.
- The backend's address is a **build setting** (`VITE_API_BASE`), chosen
  when the page is built: GitHub Actions sets it to the Render address for
  the online build. When it isn't set, the laptop address is used. It is
  not a secret: anyone can see it in the page's code.
- **Login experiment (laptop only):** started with
  `VITE_API_BASE=http://localhost:8001/api npm run dev -- --port 5174`,
  so it is served at `http://localhost:5174` and talks to the experiment
  backend on port 8001, never to a normal server on port 8000.

## Logging in

### Log in screen
When there is no valid saved token, the page shows the **log in screen**
instead of the dashboard:
- The page title as usual ("Expense Tracker"), with the subtitle
  "Log in to see your spending · " and today's full date. No + Add
  expense or Log out button.
- The server banner and the waking note, as on the dashboard.
- One cream box, about 400 pixels wide and centred, with:
  - A heading: "Log in", or "Create an account".
  - **Username** and **Password** fields, each with a visible label above
    it. The password is hidden as it is typed.
  - One sage button: **Log in**, or **Create account**.
  - A link-style button underneath to switch: "New here? Create an
    account" / "Already have an account? Log in". Switching clears the
    error messages but keeps what was typed.
- When it opens, the cursor goes to the Username field. Pressing Enter in
  either field sends the form.
- A message from the backend that isn't about one field (such as
  "Username or password is incorrect.", or "Your session has expired.
  Please log in again." after being sent back here) shows in red at the
  top of the box.

### Frontend checks before sending
If one fails, its message shows under its field and nothing is sent.
- Username empty (after removing spaces at the ends): "Please enter a
  username."
- Password empty: "Please enter a password."
- Only when creating an account, the backend's rules with the same
  messages: "Username must be 3 to 20 characters, using only letters,
  numbers and underscores.", "Password must be at least 8 characters.",
  "Password must be 64 characters or fewer.", and "Password can't be the
  same as your username."

### States
- **Sending:** the button shows "Logging in..." or "Creating account..."
  and is disabled.
- **Success:** the token is saved in localStorage, and the dashboard
  opens and loads as usual.
- **Refused (422):** the backend's message under the field named in
  `field`, or at the top of the box if `field` is null. Keep what was
  typed.
- **Wrong login (401):** "Username or password is incorrect." at the top
  of the box. The password field is cleared; the username is kept.
- **Server error (500):** "Something went wrong on the server. Please try
  again." at the top of the box.
- **Can't reach server:** "Can't reach the server. Check that the backend
  is running, then try again." at the top of the box, and the server
  banner.

### Opening the page
- No saved token: the log in screen.
- A saved token: the page asks who is logged in (`GET /api/auth/me`).
  While waiting, the page title shows with "Loading..." underneath. If it
  answers, the dashboard opens; if it answers 401, the token is removed
  and the log in screen opens (with "Your session has expired. Please log
  in again." for `session_expired`); if the server can't be reached, the
  log in screen shows with the server banner, and **Try again** asks
  again.

### Logging out
- A light **Log out** button sits in the title row, just left of
  **+ Add expense**. (On phones, both buttons move below the subtitle.)
- Clicking it asks the backend to end the session
  (`POST /api/auth/logout`), then, whatever the answer (even if the
  server can't be reached), removes the token from localStorage, clears
  everything the dashboard had loaded, and shows the log in screen.

### When the session ends while using the page
- The token is sent with every request, in the `Authorization` header.
- If **any** request answers **401**, the page removes the token, closes
  any open popup (anything typed in it is lost), clears the dashboard's
  data, and shows the log in screen with the backend's message (for
  example "Your session has expired. Please log in again.").
- The dashboard's data is never shown to someone who isn't logged in.

## Screen layout
The app is **one page** laid out as a dashboard, with these parts:

1. **Page title**: "Expense Tracker", with a greeting and today's full
   date underneath, for example "Hi shivani, here's your spending ·
   Thursday, 8 October 2026". It sits directly on the pink page, with no
   bar or box behind it. A **Log out** button and a **+ Add expense**
   button sit at the right end of this title row.
2. **Server banner**: hidden unless the server can't be reached.
3. **Spent this month box**: a highlight box showing the total spent this
   month across all categories, a short insight line, and arrows to look
   back at earlier months' totals.
4. Below that box, **two columns** side by side:
   - **Left (a bit more than half the width): one cream box** headed
     "This month: October 2026", with a **Manage categories** button,
     holding one card per category.
   - **Right: the Expenses box**, with a month choice next to its
     heading. It lists the chosen month's expenses (or all of them),
     newest first.

On a phone, these all stack into one column in the order above: page
title (with the + Add expense button), banner, Spent this month box,
category cards, expense list.

Adding an expense happens in the **Add expense popup** (see section 2),
and editing one in the **Edit expense popup** (see section 3). Adding,
renaming, and deleting categories happens in the **Manage categories
popup** (see section 5).

### Money and date display
- Money is shown in rupees with 2 decimals and Indian digit grouping, for
  example `Rs 1,25,000.50`. The frontend converts paise to rupees for
  display only.
- Expense rows show the day as "Today", "Yesterday", or a short date
  (see "Expense list").
- Months are shown with the full month name, like `September 2026`.
- **The current month** for the month arrows and the month choice is
  worked out in IST from the computer's clock, like the date under the
  page title, so the page knows it straight away. The backend still
  refuses any month after its own current month.
- An amount that is missing or is not a whole number of paise is shown as
  `Rs –`. The page never shows "NaN" or any other technical text in place
  of an amount.

---

## Visual design

### Overall style
- **Page background:** soft baby pink.
- **No white surfaces:** nothing on the page has a pure white
  background, because white does not match the pink and green.
- **No header bar:** the page title sits directly on the pink page, with
  no bar or box behind it.
- **Boxes:** soft cream, with rounded corners and a thin border so they
  stand out from the pink page. The Spent this month box, the category
  box, the Expenses box, and the popups are cream boxes.
- **Category cards and input fields:** a slightly lighter cream than the
  boxes, with a thin border, so they still stand out inside the boxes.
  Light (secondary) buttons, such as Cancel and Set limit, use the same
  lighter cream.
- **Accent colour:** sage green, used for buttons, links, and progress
  bars. No other accent colours, with one exception: the **category icon
  circles** use three soft tints taken from the existing palette (light
  sage, soft pink, and warm beige), each with its own darker icon colour
  (see "Category icons" and the table below). Buttons use a deep sage so
  the light cream text on them is easy to read.
- **Red:** used **only** for over-limit warnings and error messages
  (including the server banner and the delete confirmation). Nothing else
  is red. Category icons are never red, so red always means "over limit"
  or "error".
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
  - Category icons are decorative, but each icon colour still meets
    **4.5 : 1** against its own circle.
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
| Icon circle: light sage, with a deep sage icon `#4F6F52` | `#E3EAE0` | sage icon on it: 4.6 : 1 |
| Icon circle: soft pink, with a plum icon `#553047` | `#F6DCE6` | plum icon on it: 8.6 : 1 |
| Icon circle: warm beige, with a dark brown icon | `#EFE3CF` | dark brown `#5C4033` on it: 7.4 : 1 |

- The over-limit card's light red is deliberately stronger than a pale
  pink, so it is clearly different from the creams around it, not only
  through its red border and text.

- Small changes to these exact colours are fine during the build, as long
  as every pair still meets the readability rule.
- **Font:** Inter, loaded from Google Fonts. If it can't load (for
  example with no internet), the browser's normal system font is used and
  the page still works.
- **Less scrolling:** the page should look like an app, not a long
  form. On a laptop, the page title (with the + Add expense button), the
  Spent this month box, and the top of both columns (category cards and
  expense list) should fit on the first screen.
- **Use the screen width:** the page content is up to about 1400 pixels
  wide, with small margins (about 24 pixels) on each side, instead of a
  narrow centred column.

### Page columns
- On a laptop or wider screen (about 1000 pixels wide or more), the area
  below the Spent this month box is split into two columns:
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
  - **Line 2,** smaller, underneath: "Hi ", the logged-in username,
    ", here's your spending · " and today's full date, for example "Hi
    shivani, here's your spending · Thursday, 8 October 2026" (weekday,
    day, month name, year). It uses the page subtitle plum.
- The date comes from the browser's own clock, so it shows even before
  the backend answers or when the server can't be reached.
- **+ Add expense button:** a solid sage button, like the other main
  buttons, at the right end of the title row, level with the title. It
  opens the Add expense popup (section 2). It is always available,
  including while the page is loading or the server can't be reached.
  - On narrow screens (phones), where the title and the button don't fit
    side by side, the button moves below the subtitle, left-aligned with
    the title.
- **Waking note:** the online backend sleeps when nobody has used it for a
  while, and takes about a minute to wake up. If the page's first load
  (the cards, list, months, and Spent this month total) is still waiting
  after **5 seconds**, a small note appears under the subtitle, in the
  secondary muted plum: "Waking up the server, this can take up to a
  minute..." It is not red, because nothing has gone wrong. It
  disappears as soon as the first load finishes, whether it succeeds or
  not, and does not appear for later reloads. Screen readers announce it
  politely.

### Spent this month box
- A cream box, styled like the other boxes, across the full width of the
  page, between the page title (and the server banner, when it shows) and
  the two columns. Its text is left-aligned with the boxes below.
- Up to four lines:
  - **The label**, small, in the secondary muted plum: "Spent this month"
    when showing the current month, otherwise "Spent in " and the month,
    for example "Spent in September 2026".
  - **The amount** in large, bold text in the main deep plum, for example
    `Rs 94.10`. It is always worked out by the backend; the page never
    adds amounts up itself. For the current month it is the summary's
    `total_spent_paise`. For other months it comes from the month total
    (endpoint 11 in `specs/api-contract-spec.md`).
  - **The insight line**, directly under the amount, in the secondary
    muted plum, for example "Rs 620.00 less than September · Food is your
    biggest category". See "Insight line" below.
  - **The month** underneath, for example "October 2026", in the
    secondary muted plum. It is shown only for the current month. For
    other months it is hidden, because the label already names the month.
- **Month arrows:** two small light buttons, ‹ and ›, side by side at the
  right of the box, level with the label. Screen-reader labels and
  tooltips: "Previous month" and "Next month".
  - ‹ shows the month before; › shows the month after. Months with no
    expenses in between are not skipped: they show Rs 0.00.
  - › is disabled on the current month, so no future month can be shown.
  - ‹ is disabled on the month of the earliest expense (the last month
    in the months list, endpoint 10), or earlier. It is also disabled
    until that list has loaded, if it can't be loaded, and when there are
    no expenses at all.
  - Each time the page opens, the box starts on the current month. The
    chosen month is not remembered after a reload.
  - The arrows don't change the Expenses box's month choice or the
    category cards, which always show the current month.
- **States:**
  - Before the total has loaded: the label, then "Loading..." in place
    of the amount, and no month line.
  - If the total can't be loaded (and nothing was loaded earlier for that
    month): the label, then `Rs –`, and no month line. For the current
    month, the category box also shows the error message and Try again,
    as before. If the server can't be reached, the server banner
    also shows.
  - A missing or invalid total shows `Rs –`, never "NaN".
  - Rs 0.00 when nothing has been spent in that month.
- After every successful add, edit, delete, or category change, the
  shown month's total (with its insight line) and the months list reload,
  and the box stays on the month it was showing.

### Insight line
- It describes **whichever month the box is showing** (the current month,
  or an earlier one chosen with the arrows), compared with the month just
  before it. It comes from the backend with that month's total (the
  `insight` value in `specs/api-contract-spec.md`). The page only turns
  it into words; it never adds up or subtracts amounts itself.
- It has up to two parts, joined by " · ":
  1. **Compared with the month before** (only when that month has at
     least one expense):
     - "Rs 620.00 less than September" when less was spent,
     - "Rs 620.00 more than September" when more was spent,
     - "Same as September" when the totals are exactly equal.
     The month before is named by its month name only, or with its year
     when it is in a different year, for example "less than December
     2025". The amount uses the normal money format, with 2 decimals.

     **Trend icon:** a small icon (about the height of the text) at the
     start of this part, just before the words:
     - **less** than the month before: an arrow pointing **down**, in
       sage green `#4F6F52` (5.0 : 1 on the cream box);
     - **more** than the month before: an arrow pointing **up**, in muted
       plum `#6A5260` (6.3 : 1 on the cream box). Not red, because red
       only means over limit or error;
     - **the same**: a **flat line**, in muted plum `#6A5260`.

     With no comparison, there is no icon. The icon is decorative and
     hidden from screen readers, because the words already say the same
     thing.
  2. **The biggest category** (only when the shown month has at least
     one expense): "Food is your biggest category". If two or more
     categories tie for the most spent, all of them are named, in
     category order: "Food and Bills are your biggest categories", or
     "Food, Bills and Other are your biggest categories".
- **When neither part applies** (no expenses in the shown month or the
  month before): "No expenses in October 2026." (with the shown month).
- **When only one part applies**, only that part shows, for example "Food
  is your biggest category" in the first month with expenses, or
  "Rs 9,210.00 less than September" early in a month with no expenses
  yet.
- No insight line while the total is loading, or if it can't be loaded.
- If the insight is missing or can't be read, the line is left out; the
  total still shows.

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
  - The category's **icon** (see "Category icons") to the left of the
    **category name**.
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
  clearly. The warning is always in words, not just colour. The icon
  circle keeps its own tint; it never turns red.

### Category icons
- Each category has a small line icon inside a soft coloured circle
  (about 32 pixels across, icon about 18 pixels). It appears on the
  category's card and on each of its expense rows.
- **The icon follows the category, not its name:** the six starting
  categories always keep their icons, even after being renamed (Food
  renamed to Groceries keeps the fork and knife). Every category created
  in the Manage categories popup gets the default icon, whatever its name,
  even "Food". The page picks the icon from the category's `icon` value
  sent by the backend (see `specs/api-contract-spec.md`), not from its
  id, because each account's starting six have different ids. An `icon`
  value the page doesn't know gets the tag.

| Category (`icon` value) | Icon | Circle | Icon colour |
|---|---|---|---|
| Food (`food`) | fork and knife | soft pink `#F6DCE6` | plum `#553047` |
| Transport (`transport`) | bus | light sage `#E3EAE0` | deep sage `#4F6F52` |
| Shopping (`shopping`) | shopping bag | warm beige `#EFE3CF` | dark brown `#5C4033` |
| Bills (`bills`) | receipt | light sage `#E3EAE0` | deep sage `#4F6F52` |
| Entertainment (`entertainment`) | film ticket | soft pink `#F6DCE6` | plum `#553047` |
| Other (`other`) | three dots | warm beige `#EFE3CF` | dark brown `#5C4033` |
| Any category you create (`tag`) | tag | light sage `#E3EAE0` | deep sage `#4F6F52` |

- **Decorative for screen readers:** icons are hidden from screen readers
  and have no text of their own, because the category name is always
  shown next to them in words.
- The icons are drawn in the page's own code (like the pencil and bin),
  so nothing extra is downloaded.

### Popup (add expense)
- Looks exactly like the edit popup: a cream box in the middle of the
  screen, over a darkened page, with lighter cream input fields.
- Title "Add expense", the four fields (Amount, Category, Date, Note)
  stacked one per line, each with a visible label above it, then **Add
  expense** and **Cancel**.
- The Category box starts empty, showing "Choose a category" in muted
  plum placeholder text.
- Each error message appears **under its field**, as in the edit popup.
  Messages that are not about one field appear at the top of the popup.
- While the popup is open, the page behind it can't be used.
- When it opens, the cursor goes to the Amount field. When it closes, the
  cursor goes back to the + Add expense button.

### Expense list
- **Month choice:** a drop-down at the right end of the "Expenses"
  heading line, styled like the other input fields (lighter cream), with
  the screen-reader label "Show expenses from". See section 4 for how it
  works.
- Each expense is one row showing, left to right:
  1. The category's **icon** (see "Category icons").
  2. Two lines of text:
     - **Main text**, in the main deep plum: the expense's **note**, or
       the **category name** if it has no note.
     - **Small text** underneath, in the secondary muted plum: the
       category and the day, joined by " · ", for example "Food · Today".
       If the main text is already the category name (no note), only the
       day shows, for example "Yesterday", so the name isn't repeated.
  3. The **amount**, right-aligned, in the main deep plum.
  4. Two small **icon buttons**: edit (pencil) and delete (bin).
- **The day** is worked out in IST, like the current month:
  - "Today" for today's date,
  - "Yesterday" for the day before,
  - otherwise a short date: "12 Oct" in the current year, or "12 Oct
    2025" in other years.
- The icon buttons have text labels for screen readers ("Edit expense",
  "Delete expense") and show the same words as a tooltip on hover.
- Rows are separated by thin lines. No other decoration.
- **No column headings.** The old "Date", "Category", "Note", "Amount"
  headings are removed, because the rows are no longer laid out in
  columns: each row explains itself (the amount is clearly an amount, and
  the small text names the category and day).
- Long notes wrap onto more lines within the text part; the icon, the
  amount, and the icon buttons stay on the row and stay visible. The same
  layout is used on every screen width, so rows no longer switch to a
  different layout on narrow screens.
- Screen readers read each row in order: note (or category), category
  and day, amount, then the two buttons.
- The delete confirmation appears inside that expense's row (see
  section 4).

### Popup (edit expense)
- A cream box in the middle of the screen, over a darkened page. Its
  input fields are the lighter cream, like the add expense popup's.
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

### Success messages
- A small sage green label with light cream text (5.4 : 1, the same pair
  as the buttons) and rounded corners, starting with a check mark, for
  example "✓ Expense added". Because it has its own sage background, it
  is equally readable on cream, lighter cream, and the light red of an
  over-limit card.
- It appears **inside the box where the change was made** (see section 7
  for where), not floating over the page.
- It does not block anything: it never covers anything, never takes the
  cursor or keyboard focus, and has no buttons. While it shows, it takes a
  line of space in its box, so the content below it moves down by that
  much, then back when it disappears.

### Narrow phone screens
- Everything stacks into **one column**, in this order: page title (with
  the + Add expense button below the subtitle), banner, Spent this month
  box, the category box (one card per row), and the Expenses box (long
  notes wrap, and the amount and icon buttons stay visible).
- The popups fit the screen width, with their fields stacked one per
  line.
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
- The same kind of checks as the expense form, worded for the limit:
  - Empty: "Please enter a limit."
  - Not a number: "Limit must be a number, like 5000.00."
  - 0 or less: "Limit must be greater than 0."
  - More than 2 decimal places: "Limit can have at most 2 decimal
    places."
  - Over Rs 10,00,00,000.00: "Limit is too large."
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

## 2. Add expense popup

The popup is only for adding. Editing uses its own popup (section 3).

### Opening and closing
- The **+ Add expense** button in the page title row opens the popup,
  with every field at its default (below).
- **Cancel** closes the popup without saving, and anything typed is
  discarded. Pressing the Escape key does the same.
- Clicking the darkened page behind the popup does **not** close it, so
  typed details are not lost by accident.
- While saving, Cancel and Escape do nothing until the answer comes back.
- Opening the popup again always starts fresh, with the defaults.

### Fields
| Field    | Input                         | Default    |
|----------|-------------------------------|------------|
| Amount   | Text box for rupees, e.g. 12.50 | empty    |
| Category | Drop-down of the current categories, in category order | none: shows "Choose a category" |
| Date     | Date picker, cannot pick a day after today | today |
| Note     | Text box, max 100 characters  | empty      |

Buttons: **Add expense** and **Cancel**.

- The category list comes from the summary. Until the summary has loaded,
  the Category box offers only "Choose a category".
- If the list of categories changes while the popup is open (for example
  after a reload) and the chosen category is no longer in it, the
  Category box goes back to "Choose a category". The rest of the popup
  keeps what was typed.

### Frontend checks before sending
If one fails, show its message under its field and send nothing. The
same checks and messages are used in the edit popup.
- Amount empty: "Please enter an amount."
- Amount not a number: "Amount must be a number, like 12.50."
- Amount 0 or less: "Amount must be greater than 0."
- Amount with more than 2 decimal places: "Amount can have at most 2
  decimal places."
- Amount over Rs 10,00,00,000.00: "Amount is too large." (Exactly
  Rs 10,00,00,000.00 is allowed.)
- Category not chosen: "Please choose a category." Only the add popup
  can have no category; the edit popup always has one.
- Date empty: "Please choose a date."
- Date after today: "Date cannot be in the future."
- Note over 100 characters: "Note must be 100 characters or fewer."

When the checks pass, the amount is converted from rupees to whole paise
(12.50 becomes 1250) and sent.

### States
- **Saving:** **Add expense** shows "Saving..." and is disabled, so the
  expense can't be sent twice.
- **Success:** the popup closes, and "Expense added" shows in the Expenses
  box (section 7). The list, the cards, and the Spent this month box
  reload.
- **Refused by backend (422):** show the backend's `message` under the
  field named in `field`, or at the top of the popup if `field` is null.
  Keep everything the user typed.
- **Server error (500):** show "Something went wrong on the server. Please
  try again." at the top of the popup. Keep everything the user typed.
- **Can't reach server:** show "Can't reach the server. Check that the
  backend is running, then try again." at the top of the popup, and show
  the server banner on the page behind it (see section 6). The popup
  stays open with everything the user typed, so they can try **Add
  expense** again.

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
- Only one popup can be open at a time.

### Checks
The same frontend checks and messages as the add popup (section 2). Each
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

The expenses of the chosen month, or of every month, newest first, in the
order the backend returns them. How each row looks is described under
**Visual design**.

### Choosing a month
- The drop-down's options, in this order:
  - "All months".
  - Every month that has at least one expense (from the months list,
    endpoint 10), newest first, for example "October 2026", "September
    2026".
  - Two months are always offered even if they have no expenses, placed
    in date order among the others: the **current month** (so the
    starting choice is always there) and the **chosen month** (so it
    stays chosen after its last expense is deleted).
- Each time the page opens, the choice starts on the current month. It is
  not remembered after a reload.
- Choosing a month asks the backend for that month's expenses
  (`GET /api/expenses?month=…`); "All months" asks for every expense. The
  page never filters the list itself.
- While the new list loads, "Loading expenses..." shows in place of the
  list.
- After an expense is added, edited, or deleted, the list reloads for the
  **same** choice. An expense dated in another month is saved but doesn't
  appear until that month (or "All months") is chosen.
- The month choice doesn't change the Spent this month box or the
  category cards.

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
- **Empty (a month is chosen):** "No expenses in September 2026." (with
  the chosen month).
- **Empty ("All months"):** "No expenses yet. Add your first one above."
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
because the connection fails or because nothing comes back within 90
seconds (long enough for the sleeping online backend to wake up). This covers loading the page, adding, editing, deleting,
setting limits, and adding, renaming, or deleting categories.

**What the user sees:**
- A red banner at the top of the page, just below the page title:
  **"Can't reach the server. Check that the backend is running, then
  try again."**
  with a **Try again** button.
- The rest of the page still shows: page title, the + Add expense
  button, Spent this month box, and any cards or list already loaded.
  The page is never blank or broken, and no raw technical error text is
  shown.
- Anything the user had typed in the add popup, the edit popup, a limit
  box, or the Manage categories popup is kept.

**Try again:** reloads the cards, the list (for the chosen month), the
months list, and the Spent this month box's total. If they all load, the
banner disappears. If the server still can't be reached, the banner stays.

**Manual check:** stop the backend, open or reload the page, and confirm
the banner shows instead of a blank page. Start the backend, click
**Try again**, and confirm the banner disappears and the data loads.
- On the laptop: stop the backend with Ctrl+C, then start it again.
- Online: in Render, click **Suspend** on the backend service, then
  **Resume** it.

---

## 7. Success messages

After every **successful** change, a success message shows for about 3
seconds, inside the box where the change was made:

| Change | Message | Where it appears |
|---|---|---|
| Adding an expense | Expense added | Expenses box, at the top of the list |
| Saving changes to an expense | Expense updated | Expenses box, at the top of the list |
| Deleting an expense | Expense deleted | Expenses box, at the top of the list |
| Setting or changing a limit | Limit saved | Inside that category's card |
| Adding a category | Category added | Manage categories popup, at the top of the list |
| Renaming a category | Category renamed | Manage categories popup, at the top of the list |
| Deleting a category | Category deleted | Manage categories popup, at the top of the list |

- **Only for success.** No success message appears when a change is
  refused, fails, or the server can't be reached; those keep showing
  their own messages as described above. Loading or reloading data never
  shows one.
- **One at a time, on the whole page.** If another change succeeds while
  a message is showing, the old message disappears and the new one shows
  in its own place, and the 3 seconds start again.
- **Screen readers** announce each message politely (without interrupting
  what is being read). Each of the places above has a status area that is
  always present, so the message is announced where it appears, including
  inside the Manage categories popup.
- **Closing the Manage categories popup** removes any message still
  showing in it.
- **"Expense added"** and **"Expense updated"** appear after their popup
  has closed, so they are seen in the Expenses box, where the expense
  appears. (If the Expenses box is showing a different month from the
  new expense's date, the message still shows there, and the expense
  appears when its month or "All months" is chosen.)

---

## User flow
0. **Log in.** Open the page. Without a saved session, the log in screen
   shows. Log in, or switch to **Create an account** and sign up. The
   dashboard opens with "Hi <username>". (See "Logging in".)
1. **Open the page.** The cards and list show their loading states, then
   their data (or the empty/error/server states above).
2. **Add an expense.** Click **+ Add expense**. In the popup, fill in the
   fields (including choosing a category) and click **Add expense**. The
   popup closes, "Expense added" shows in the Expenses box, and the list,
   cards, and Spent this month box update. If the category is now over its limit, its card turns
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
7. **Look back at earlier months.** Click ‹ in the Spent this month box
   to see last month's total, and › to come back. Choose a month in the
   Expenses box to list only that month's expenses, or "All months".
8. **Reload the page** at any time. Everything saved is still there,
   because the data lives in the backend, and you stay logged in until
   the session ends. The arrows and the month choice start on the
   current month again.
9. **Log out.** Click **Log out**. The log in screen shows, and another
   person can log in with their own account and see only their own data.

After every successful add, edit, delete, limit change, or category
change, the frontend reloads the list (for the chosen month), the cards,
the months list, and the Spent this month box's total from the backend.
It does not work out totals itself.
