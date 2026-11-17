# Societree Forest Care

Maintenance app for Societree's community forests: log site visits, see which forests need attention, and keep track of stock. It replaces the Base44 app.

- **App:** Expo (React Native, Expo Router, TypeScript) for web (PWA), Android and iOS
- **Backend:** Supabase (Postgres, Auth, Storage, Row Level Security)
- **Brief and build plan:** [CLAUDE.md](CLAUDE.md). **UI reference:** [prototype/societree-prototype.html](prototype/societree-prototype.html)

## Layout

```
src/app/               screens (Expo Router: every file is a route)
src/constants/theme.ts colours from the design brief
src/lib/supabase.ts    Supabase client
src/lib/database.types.ts  generated from the schema (npm run db:types)
supabase/migrations/   schema, RLS and storage SQL
scripts/seed.mjs       loads seed/societree-seed-data.json
scripts/test-rls.mjs   permission checks (local Supabase only)
src/lib/logic.ts       overdue, score and low-stock rules (npm test)
seed/                  Base44 export (raw CSV + cleaned JSON)
```

## First-time setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, publishable key and secret key.
3. Apply the database migrations to your Supabase project:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
4. Load the existing data, once: `npm run seed`. Or, without Node: open `seed/societree-seed.sql`, copy all of it, and paste it into the Supabase dashboard's **SQL Editor** → Run. (Regenerate that file with `npm run seed:sql` if the JSON changes.)
5. Run the app: `npm run web` (or `npm start` and scan the QR code with Expo Go)

## Local development database (optional, needs Docker)

```bash
npx supabase start          # local Postgres/Auth/Storage with the migrations applied
npx supabase status -o env  # local URL and keys for .env.local
npm run seed
npm run test:rls
```

After changing the schema, add a new file in `supabase/migrations/` and run `npm run db:types`.

## Accounts and permissions

People sign in with email and password. The first person to sign up becomes the admin. Everyone after that waits as **pending** and sees nothing until an admin approves them (👤 → People and approvals).

- **Volunteers** can read everything, log visits, add and tick jobs, upload photos, add and change stock, and edit site details (including the GPS location).
- **Admins** can also add and delete sites, delete visits and stock items, change settings, approve people and change roles. There must always be at least one admin.
- The People screen also links names from the old Base44 visits ("Thomas Woodward", "tommysocietree", ...) to real accounts.

In the Supabase dashboard, under **Authentication → URL Configuration**, set the Site URL to the web app's address (for now `http://localhost:8081`). Confirmation and password-reset emails link back there.

## Web app (PWA) and hosting

`npm run build:web` builds the web app into `dist/` and fills in the service worker's file list. The app can be installed on phones ("Add to Home Screen"), opens without signal, and always loads live data from Supabase.

Hosting is on **Cloudflare Workers** (free, static files only), connected to this GitHub repo. `wrangler.jsonc` tells Cloudflare to serve `dist/` as a single-page app.

- Build command: `npm run build:web`
- Deploy command: `npx wrangler deploy`
- Build variables (Settings → Build → Variables and secrets): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable key), `NODE_VERSION` = `22`
- The Worker's name in the dashboard must match `name` in `wrangler.jsonc` (`societree`).

Every push to `main` deploys the live site; other branches get their own preview link. After the first deploy, add the site's address in Supabase under **Authentication → URL Configuration** (Site URL, plus Redirect URLs).

## CI

Every push runs typecheck, lint and a web build. A second job starts Supabase in Docker, applies the migrations, seeds the data and runs the RLS checks.
