# Daily Entries

A private team site where **4 users** submit one entry per day and an **admin** sees everything. Data lives in a **Google Sheet** (or an in-memory mock store for local dev).

## Features

- One entry per day per user (Date, A, B, C, D — all free text)
- Users see/edit/delete only their own entries
- Admin sees all entries (read-only on site, edits in Google Sheets)
- "Not submitted today" list
- EN/AR with full RTL support
- Light/dark themes
- Mobile-first responsive design
- Mock mode for zero-config local development

## Quick start (Excel mode, no credentials needed)

```bash
cp .env.example .env.local
# Defaults: AUTH_MODE=mock, SHEETS_MODE=excel
npm install
npm run dev
```

The app auto-creates `data/entries.xlsx` with seed data on first run. Open `http://localhost:3000/en` and sign in:

| Role  | Email             | Password   |
|-------|-------------------|------------|
| Admin | admin@team.com    | admin123   |
| User  | sara@team.com     | user123    |
| User  | omar@team.com     | user123    |
| User  | layla@team.com    | user123    |
| User  | karim@team.com    | user123    |

## Running with Docker

```bash
docker compose -f docker-compose.base44.yml up -d
```

## Setup for production (Supabase + Google Sheets)

### 1. Google Cloud — Service Account & Sheets API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Enable the **Google Sheets API** (APIs & Services → Library → search "Google Sheets API" → Enable).
4. Go to **IAM & Admin → Service Accounts → Create service account**.
5. Give it a name (e.g. "daily-entries-sa"), create and continue.
6. Open the service account → **Keys → Add Key → Create new key → JSON**. Download the JSON file.
7. Create a Google Sheet with a tab named `Entries` and header row:

   `Date | User | A | B | C | D | UpdatedAt`

8. Share the sheet with the service account email (from the JSON) as **Editor**.
9. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/`**`SHEET_ID`**`/edit`.

Set these env vars:
```
SHEETS_MODE=real
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id
```

> **Tip:** Protect the `Date` and `User` columns in Google Sheets (Data → Protect range) so the admin doesn't accidentally break the row key.

### 2. Supabase — Auth

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Go to **Settings → API** and copy the project URL, anon key, and service role key.
3. (Optional) Create a `profiles` table with RLS for stricter role protection:

   ```sql
   CREATE TABLE profiles (
     user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
     name TEXT NOT NULL DEFAULT '',
     role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
   );

   -- Users can read their own profile
   CREATE POLICY "read own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
   -- Only service role can write
   CREATE POLICY "service role write" ON profiles FOR ALL USING (auth.role() = 'service_role');
   ```

Set these env vars:
```
AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create users

```bash
# Admin
npm run create-user -- --email admin@team.com --name "Admin" --role admin --password "yourpass"

# Users
npm run create-user -- --email sara@team.com --name "Sara Ahmed" --role user --password "yourpass"
npm run create-user -- --email omar@team.com --name "Omar Hassan" --role user --password "yourpass"
npm run create-user -- --email layla@team.com --name "Layla Mostafa" --role user --password "yourpass"
npm run create-user -- --email karim@team.com --name "Karim Tarek" --role user --password "yourpass"
```

Reset a password:
```bash
npm run reset-password -- --email sara@team.com --password "newpass"
```

## Data modes

| Mode | `SHEETS_MODE` | Description |
|------|---------------|-------------|
| Mock | `mock` | In-memory store with seed data, resets on restart |
| Excel | `excel` (default) | Local `.xlsx` file at `EXCEL_FILE_PATH` (default `data/entries.xlsx`), auto-created with seed data |
| Google Sheets | `real` | Google Sheets API via service account (see below) |

For Excel mode, no credentials are needed. The file is created automatically with the `Entries` sheet and header row: `Date | User | A | B | C | D | UpdatedAt`.

### 4. Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Set all environment variables in Vercel's project settings.
4. Deploy.

## Manual test checklist

- [ ] **User isolation**: Log in as Sara → only Sara's entries are visible. Log in as Omar → only Omar's.
- [ ] **Edit/delete own entry**: Edit today's entry → changes persist. Delete a past entry → removed.
- [ ] **One-entry-per-day**: Submit today's entry twice → the row updates, no duplicate created.
- [ ] **Admin view**: Log in as admin → all users' entries visible. No edit/delete buttons.
- [ ] **Admin edits in Sheets**: (real mode) Change a cell in Google Sheets → click Refresh on admin page → change appears.
- [ ] **Not submitted today**: If a user hasn't entered today's data, their name appears in the "Not submitted today" list.
- [ ] **Arabic RTL**: Toggle to Arabic → layout flips to RTL, text is right-aligned, icons mirror.
- [ ] **Mobile layout**: View on a 360px viewport → admin table becomes stacked cards, forms are full-width.

## Column labels

Edit `config/fields.ts` to rename the A/B/C/D column labels (EN and AR) without touching anything else.

## License

Private.
