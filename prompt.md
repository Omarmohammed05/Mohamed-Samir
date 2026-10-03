# Build prompt: Daily Entries Website (Google Sheets backed, EN/AR)

You are a senior full-stack engineer and product designer. Build a complete, production-ready web app from scratch, with clean code, a polished design, and every feature below working end to end. Do not leave TODOs or placeholder logic. If something is ambiguous, pick the sensible default, note it in the README, and keep going.

## 1. What the app is

A small private site for a team of **4 users and 1 admin**. Each user submits **one entry per day** with these fields: `Date`, `A`, `B`, `C`, `D` (all free text). Users can see and edit **only their own** entries. The admin sees everything. The data lives in a **Google Sheet** which is the single source of truth. The admin mainly edits the data directly in Google Sheets, and the website shows a quick live view of it.

## 2. Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Tailwind CSS + small accessible component set (shadcn/ui is fine)
- `next-intl` for i18n: **English (default) and Arabic**, with full RTL support
- Supabase Auth, used for login only (email + password, no public signup)
- Google Sheets API via `googleapis` with a **service account**
- `zod` for validation, `date-fns` for dates, Vitest for unit tests

## 3. Google Sheet structure

One tab named `Entries` with header row:

`Date | User | A | B | C | D | UpdatedAt`

- `User` holds the user's lowercase email.
- The unique key of a row is **(User, Date)**. Always find rows by this key, never by row number, so the admin can sort, filter, or insert rows in Sheets without breaking anything.
- Write dates as `YYYY-MM-DD` using `valueInputOption: RAW`. The reader must tolerate dates that Sheets converted (serial numbers, `D/M/YYYY`, etc.) and normalize them to `YYYY-MM-DD`.
- If the sheet contains duplicate (User, Date) rows or rows with an unknown user, don't crash. Show the first one and flag the problem as a warning on the admin page.
- Column labels for A, B, C, D must come from one config file (`config/fields.ts`) with an English and an Arabic label each, so they can be renamed easily.
- Provide `SHEETS_MODE=mock` that uses an in-memory store with sample data, so the whole app runs locally without Google credentials.

## 4. Roles and permissions (enforced server-side only)

**User**
- Create today's entry (all four fields required, max 1000 characters each)
- If today's entry already exists, the same form switches to edit mode
- View, edit, and delete their own past entries
- Can never see, request, or modify another user's rows. The API filters by the authenticated user's email and ignores any user value sent by the client.
- Cannot see the Sheet link or the admin page

**Admin**
- Sees the full table of all users
- Can open the Google Sheet with one click
- Admin page is read-only on the site, because the admin edits in Sheets

Never trust the client for role or identity. Read the session on the server for every request. Wrap this logic in one small permissions module with unit tests that prove a user cannot read or write another user's rows.

## 5. Pages and features

**`/login`**
- Email + password, clear error states, language toggle, show/hide password
- Rate-limit failed attempts
- Redirect by role after login (user → `/entries`, admin → `/admin`)

**`/entries` (user)**
- Top card: "Today" form with Date (defaults to today, Africa/Cairo time zone, editable to a past date), fields A–D, Save button, success toast
- Below: a list of the user's own entries, newest first, with edit and delete (confirm dialog), search, and pagination
- Empty state with a friendly message
- Mobile-first: most users will enter data on a phone

**`/admin`**
- Summary strip: total entries, entries today, and a "Not submitted today" list showing which users haven't entered today's data
- Full table of all entries: Date, User (name + email), A, B, C, D, UpdatedAt
- Filters: user, date range; text search; sortable columns; pagination
- Buttons: Refresh, "Open in Google Sheets", Export CSV (of the current filter)
- Data warning banner for duplicates or malformed rows
- Short cache (about 10 seconds) so the view feels live but doesn't hammer the API. Invalidate the cache after any write from the site.

**Shared**
- Header with app name, language switcher (EN / ع), theme toggle (light/dark), user menu with change password and logout
- Proper 404, 403, and error pages in both languages
- `/` redirects based on session

## 6. Auth and user management

- No signup page. Provide a script `npm run create-user -- --email x@y.com --name "Name" --role user|admin --password ...` using the Supabase admin API. Store `name` and `role` in `profiles` (or user metadata), protected so clients can't change their own role.
- Provide `npm run reset-password` the same way.
- The seed instructions in the README must create 4 users and 1 admin.

## 7. Design direction

Calm, trustworthy, modern business tool. Not generic. Think of a clean ledger or notebook feel.

- Neutral warm-gray surfaces, one confident accent color (deep teal or indigo), generous spacing, 12–16px rounded corners, subtle borders instead of heavy shadows
- Typography: Inter for English, **IBM Plex Sans Arabic** or Cairo for Arabic, with a clear type scale
- Tables that stay readable: sticky header, zebra or hairline rows, and on mobile the admin table becomes stacked cards
- Real RTL: use logical properties (`ms-`, `pe-`, `text-start`), mirror icons and layout correctly, and never just flip text
- Light and dark themes with proper contrast (WCAG AA), visible focus states, keyboard accessible, large tap targets
- Small touches: skeleton loaders, inline validation messages, optimistic UI on edits, toasts, tasteful micro-animations (respect `prefers-reduced-motion`)
- All strings in `messages/en.json` and `messages/ar.json`, with natural Arabic copy (not literal translations)

## 8. Google Sheets integration details

- Service account credentials in env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (handle `\n` escaping), `GOOGLE_SHEET_ID`
- A single `lib/sheets.ts` module exposing: `listEntries()`, `getEntry(user, date)`, `upsertEntry(user, date, data)`, `deleteEntry(user, date)`. Nothing else touches the Sheets API.
- Upsert = find by (User, Date); update the row if found, otherwise append. Set `UpdatedAt` in ISO format.
- Retry with backoff on 429/5xx. Return friendly errors to the UI.
- Write ops go through Route Handlers or Server Actions only.

## 9. Security and quality

- Validate every input with zod on the server (date format, lengths, required fields)
- Escape output; never render raw HTML from sheet cells
- Security headers, secure cookies, no secrets in client bundles
- Basic audit-safe logging with no personal data in logs
- Unit tests: permissions, date normalization, upsert/duplicate logic. A couple of integration tests against the mock store.
- Lint and typecheck must pass

## 10. Deliverables

1. Full source code in a clean structure (`app/[locale]/...`, `lib/`, `config/`, `messages/`, `scripts/`, `tests/`)
2. `.env.example` with every variable explained
3. `README.md` with step-by-step setup:
   - Creating the Google Cloud project, enabling the Sheets API, creating the service account, and sharing the sheet with its email as Editor
   - Creating the Supabase project and running any SQL
   - Creating the 4 users + admin
   - Running locally (including mock mode)
   - Deploying to Vercel and setting env vars
   - Recommendation: protect `Date` and `User` columns in Sheets so the admin doesn't accidentally break the key
4. A short "manual test checklist" covering: user isolation, edit/delete own entry, one-entry-per-day behavior, admin view, admin editing in Sheets then refreshing the site, Arabic RTL, mobile layout

## 11. Definition of done

- A user logs in, adds today's entry, edits it, and sees only their own data
- A second submit for the same date updates the existing row and never creates a duplicate
- The admin edits a cell in Google Sheets and the site shows the change after refresh
- The admin page shows who hasn't submitted today
- Switching to Arabic flips the layout to RTL correctly everywhere
- Looks great on a 360px phone and on a desktop
- Typecheck, lint, and tests pass, and the app runs in both mock and real Sheets modes

Start by outlining the file structure and the data flow in a few lines, then implement everything.
