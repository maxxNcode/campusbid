# CampusBid design notes

CampusBid is a place where students hand over money to people they have not met yet. The design aims to be trustworthy, calm and practical: quiet colours, plain words, and every rule of the trade written next to the action it affects. It is a student project, so nothing in it borrows the university's logo or colours or implies an endorsement.

All styling lives in `src/index.css`. Bootstrap 5.3 is bundled from npm (no CDN) and themed through its CSS variables; there is no Sass build.

## Palette

| Token | Hex | Used for |
| --- | --- | --- |
| `--cb-paper` | `#f6f4ee` | Page background. A warm off-white reads as paper, not as a blank app screen. |
| `--cb-surface` | `#ffffff` | Cards, forms, dialogs |
| `--cb-ink` | `#1c2523` | Body text |
| `--cb-ink-soft` | `#4b5753` | Secondary text and hints (6.9:1 on paper) |
| `--cb-line` | `#dcd8cc` | Borders and dividers |
| `--cb-line-soft` | `#ebe8df` | Row dividers, hover fills |
| `--cb-green` | `#1f5f52` | Primary buttons, links, focus ring, the brand mark (7.5:1 with white) |
| `--cb-green-dark` | `#164a3f` | Hover and pressed states |
| `--cb-green-tint` | `#e2efe9` | Success notices, the active nav item, outline-button hover |
| Danger | `#9b2c1c` | Withdraw, decline, reject and cancel buttons, field errors |
| Demo banner | `#ffc107` with `#1c2523` text | Only in offline demo mode, so it can never be mistaken for the real app |

The green is a deep, slightly grey forest green. It is not a school colour, and it does not shout. Red is kept for actions that end something.

### Status badges

Every status is a word in a badge: "Available", "Reserved", "Sold", "Pending" and so on. The colour only backs up the word, and each badge also has a dot so it still reads in greyscale.

| Badge | Background / text | Statuses |
| --- | --- | --- |
| green | `#e1f0e6` / `#1b5e34` | Available, Accepted |
| amber | `#fbefd5` / `#6f4304` | Reserved, Pending |
| teal | `#e2efe9` / `#155447` | Completed |
| slate | `#e7e9ee` / `#374151` | Sold |
| stone | `#efedea` / `#57524b` | Withdrawn, Cancelled |
| red | `#f8e3df` / `#8a2a1b` | Declined |

All badge text pairs pass WCAG AA (4.5:1) for small text.

## Type

- System stack: `'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif`. Lab PCs run Windows, so Segoe UI comes first and nothing has to download.
- Body 16px with line height 1.55. Hints and meta lines are 0.875rem in `--cb-ink-soft`.
- Headings are semibold (600) or bold, sentence case, with no all-caps labels. Page titles sit around 1.75rem and card titles around 1.05rem.
- Prices are always `₱1,200.00`, with two decimals, tabular figures and semibold weight. Dates and times are always Manila time, for example "Nov 26, 2026, 10:00 AM", and forms say "(Manila time)" wherever a time is entered.

## Spacing and shape

- The spacing steps are Bootstrap's (0.25, 0.5, 1, 1.5 and 3rem). Cards use 1.25rem padding, and grids use a 1–1.5rem gap.
- Cards have a 0.75rem radius, and inputs and buttons 0.5rem. Shadows are very light: a one-pixel line plus a soft 8px blur.
- Content sits in Bootstrap's container (at most 1320px wide). Every screen is checked at 360, 768 and 1440px with no sideways scroll.
- The page header card has a faint 24px green grid behind the title, a nod to engineering graph paper. It is the only decoration.

## Components

- **Header.** Wordmark, the main links and an account menu. Below 992px it becomes a single "Menu" button that opens a list. The current page is marked with `aria-current` and a tinted background, not colour alone.
- **Page header** (`PageHeader`). Title, one or two sentences on what the page is for, and an optional main action.
- **Listing card.** Photo, status badge and category, then the title link, price, condition, and program · seller. Cards are `article` elements with a real heading.
- **Forms.** Grouped in titled sections (`fieldset` + `legend`). Every input has a visible label, hint text where it helps, and an error message tied to the field with `aria-describedby`. While a form saves, its button is disabled and reads "Saving…".
- **Confirm dialog.** A native `<dialog>` for every action that cannot be undone: accept, decline, cancel, mark as handed over, withdraw, approve, reject, and reset demo data. It says what will happen in plain words, starts focus on the safe button ("Go back" or "Keep it"), and Escape closes it without acting.
- **Messages.** Success is a green-tint notice with `role="status"`. Failures are a red notice with `role="alert"` that says what to do next. Loading shows a spinner with a sentence ("Loading your listings…"). Empty states explain why the list is empty and offer the next step.
- **Request timeline.** "What has happened" lists the steps in words with times; the next step is drawn hollow and announced as "not yet" to screen readers.
- **Placeholder photos.** The seed listings use drawn placeholders (a line icon on graph paper with the item name) labelled "Demo listing. Not a photo of a real item." They are generated by code, so no one mistakes them for real items.
- **Footer.** States that this is a student project, not an official university service, and that payment happens in person.

## Accessibility

- Contrast meets WCAG AA for all text and controls.
- Focus is a visible 3px green ring on every interactive element.
- Status is always written in words; colour is never the only signal.
- Buttons that repeat across a list carry the item name for screen readers, for example "Withdraw Casio fx-991ES".
- The search form is a `role="search"` landmark. Browser Back and Forward restore its values from the URL.

## What is deliberately left out

- Charts, made-up statistics, testimonials and "coming soon" buttons: anything that would show data the app does not have.
- Gradients, glows and animation beyond hover and focus. A calm page makes the safety rules easier to read.
