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
4. Load the existing data, once: `npm run seed`
5. Run the app: `npm run web` (or `npm start` and scan the QR code with Expo Go)

## Local development database (optional, needs Docker)

```bash
npx supabase start          # local Postgres/Auth/Storage with the migrations applied
npx supabase status -o env  # local URL and keys for .env.local
npm run seed
npm run test:rls
```

After changing the schema, add a new file in `supabase/migrations/` and run `npm run db:types`.

## Permissions

Signed-in users can read everything, log visits, add and tick jobs, upload photos, add and change stock, and edit site details (including the GPS location). Only admins can add or delete sites, delete visits, delete stock items, change settings and change user roles. The first person to sign up becomes the admin. Signed-out users see nothing.

## CI

Every push runs typecheck, lint and a web build. A second job starts Supabase in Docker, applies the migrations, seeds the data and runs the RLS checks.
