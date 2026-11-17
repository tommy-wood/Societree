# Backups

Every Sunday night a GitHub Action (`.github/workflows/backup.yml`) copies Societree to **Cloudflare R2** (free up to 10 GB):

- `database/YYYY-MM-DD/` — a full export of the database (sites, visits, jobs, stock, hours, invoices, user accounts, and the list of stored files), gzipped. One folder per week, all kept.
- `files/visit-photos/…` and `files/receipts/…` — every photo and receipt. Only new files are copied each week, and **nothing is ever deleted from the backup**, so a photo removed from the app is still kept here.

Why: Supabase's free plan has no backups, and even paid-plan backups cover the database only, not the photo files. The weekly run also keeps the free project active, so it isn't paused over holidays.

## One-off setup (about 15 minutes)

### 1. Cloudflare R2

1. Cloudflare dashboard → **Storage & databases → R2**. If asked, enable R2 (it may ask for a payment card; the first 10 GB are free).
2. **Create bucket** → name it `societree-backups` → location **Automatic** (or Western Europe) → Create.
3. Back on the R2 **Overview** page → **API Tokens: Manage** → **Create Account API token**.
   - Permission: **Object Read & Write**
   - **Apply to specific buckets only** → `societree-backups`
   - Create, then copy the **Access Key ID** and **Secret Access Key** (the secret is shown only once).
4. Note your **Account ID** (on the R2 Overview page, or in the endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).

### 2. Supabase

1. Supabase dashboard → your project → **Connect** (top of the page) → **Session pooler** → copy the connection string (it starts `postgresql://postgres.zbdbtgqbdzgjmxwhoxns:`) and put your database password in place of `[YOUR-PASSWORD]`. (If you've forgotten the password: **Project Settings → Database → Reset database password**.) Use the *Session pooler* string, not the *Direct* one: GitHub can't reach the direct address.
2. **Project Settings → API Keys** → copy a **secret key** (`sb_secret_…`), or create one called `backup`.

### 3. GitHub secrets

GitHub → the `Societree` repo → **Settings → Secrets and variables → Actions → New repository secret**. Add six:

| Name | Value |
|---|---|
| `SUPABASE_DB_URL` | the Session pooler connection string, with your password in it |
| `SUPABASE_SECRET_KEY` | the `sb_secret_…` key |
| `R2_ACCOUNT_ID` | your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from step 1.3 |
| `R2_SECRET_ACCESS_KEY` | from step 1.3 |
| `R2_BUCKET` | `societree-backups` |

Secrets are encrypted by GitHub and never shown in logs.

### 4. Test it

GitHub → **Actions → Weekly backup → Run workflow**. After a couple of minutes it should be green, and the R2 bucket should contain `database/<today>/` and `files/…`. If a scheduled run ever fails, GitHub emails the repo owner.

## Restoring

Only needed if something has gone badly wrong. You need the same settings as above in your terminal (`SUPABASE_SECRET_KEY`, `R2_…`, and `SUPABASE_URL` if restoring into a different project).

1. **Download** the newest `database/YYYY-MM-DD/` folder from the R2 bucket (Cloudflare dashboard → R2 → `societree-backups` → download) and unzip the `.gz` files.
2. **Restore the database.**
   - *Into a brand-new, empty Supabase project* (e.g. the old one was deleted): follow Supabase's guide "Backup and restore using the CLI" with `roles.sql`, `schema.sql`, `data.sql`.
   - *Into this project after data loss* (tables still exist): in a terminal with the project's connection string,
     ```bash
     psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "set session_replication_role = replica" -c "delete from public.app_settings" -c "delete from storage.buckets" -f data.sql
     ```
     (Clear out any partial data first. This was tested end to end on a local copy.)
3. **Restore the photos and receipts** from R2 into Supabase Storage:
   ```bash
   npm ci
   node scripts/restore-files.mjs
   ```
   It skips files that are already there (add `--overwrite` to replace them).

The CI run on every push tests the backup and file-restore scripts against a local copy, so they keep working as the app changes.
