# Daily Entries — Base44 Dev Environment

## Overview
Next.js 15 App Router + TypeScript app for daily team entries, backed by Google Sheets (or a mock in-memory store). Auth via Supabase or mock mode.

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
- App at `http://localhost:3000` (preview port 3000)
- Health check: `GET /en`

## Modes
- `AUTH_MODE=mock` (default): uses 5 predefined users in `config/mock-users.ts`, session signed with `JWT_SECRET`
- `AUTH_MODE=supabase`: uses Supabase Auth (requires Supabase env vars)
- `SHEETS_MODE=excel` (default): reads/writes a local Excel file at `EXCEL_FILE_PATH` (default `data/entries.xlsx`), auto-created with seed data
- `SHEETS_MODE=mock`: in-memory store with seed data in `lib/mock-store.ts` (resets on restart)
- `SHEETS_MODE=real`: uses Google Sheets API (requires Google env vars)

## Demo credentials (mock mode)
- Admin: `admin@team.com` / `admin123`
- User: `sara@team.com` / `user123` (also omar, layla, karim — same password)

## Key architecture decisions
- **Auth abstraction** (`lib/auth.ts`): unified `getSession()` works in both mock and Supabase modes. Mock mode signs a JWT in a cookie; Supabase mode reads the Supabase session.
- **Permissions** (`lib/permissions.ts`): server-side only. Users can only read/write/delete their own entries. Admin is read-only on the site (edits in Sheets).
- **Sheets module** (`lib/sheets.ts`): single module touching the data store. Finds rows by (User, Date) key, never by row number. Excel mode (`lib/excel-store.ts`) reads/writes a local .xlsx file. Mock mode delegates to `lib/mock-store.ts`. Real mode uses Google Sheets API.
- **i18n**: next-intl with `en`/`ar` locales, full RTL support. Messages in `messages/en.json` and `messages/ar.json`.
- **Cache** (`lib/cache.ts`): 10-second TTL for admin data. Invalidated on writes.
- **Sheet highlighting** (`lib/conditional-formatting.ts`): existing Sheet rules must be re-synced with the admin's **Apply to Sheet** button after formatting code changes; hot reload alone does not update the Sheet. Entries are written as RAW strings, so the rules must coerce numeric text (not just use `ISNUMBER` directly). Out-of-range values get an amber background and dark amber text without rewriting cell data. Test the rule payload with `npm run test -- tests/conditional-formatting.test.ts`.

## Commands
- `npm run dev` — dev server on port 3000
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run test` — Vitest unit/integration tests
- `npm run build` — production build

## File structure
```
app/
  [locale]/          # locale-segmented routes (en, ar)
    login/           # login page
    entries/         # user entries page
    admin/           # admin dashboard
  api/               # route handlers (auth, entries, admin)
components/          # UI components + shared
config/              # field labels, mock users
lib/                 # auth, permissions, sheets, cache, validators, date utils
messages/            # i18n strings (en, ar)
scripts/             # create-user, reset-password (Supabase admin API)
tests/               # Vitest tests
```
