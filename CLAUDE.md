# Societree Forest Care: project brief for Claude Code

Societree is a UK charity (Plymouth, Devon) that plants and looks after small community "forests" (dense mini-woodlands) at schools, parks and other sites. This app replaces a Base44 app (societree-forest-pulse) that hit its integration limit. Staff and volunteers use it on their phones to log visits, see which forests need work, and keep track of stock.

**Constraints:** free or as cheap as possible (charity). Simple UI that people will actually keep using. Users will normally have mobile signal at the sites, so offline support is nice-to-have, not v1.

## What already exists

- `prototype/societree-prototype.html`: a working single-file prototype (Today / Sites / Stock tabs, log-visit form, jobs per site). It was built inside claude.ai with a throwaway `db` API, so **treat it as a UI/UX spec, not code to keep**. Re-implement the same screens in the real stack.
- `seed/societree-seed-data.json`: cleaned export of all current data (22 sites, 23 visits, 24 stock items). `seed/societree-records-2026-11-17.csv` is the raw Base44 export it came from.

## Target stack (all free tiers)

- **App:** Expo (React Native + Expo Router, TypeScript). One codebase for web (PWA), Android and iOS.
- **Backend:** Supabase (Postgres, Auth, Storage for photos, Row Level Security).
- **Maps:** MapLibre + OpenStreetMap tiles (no Google Maps billing).
- **Web hosting:** Cloudflare Pages or Vercel.
- **Repo:** GitHub, with CI that builds the web app on every push.
- **Stores (last):** Google Play (one-off $25 registration). Apple is $99/yr unless the charity gets the Apple fee waiver; check eligibility for a UK registered charity (the waiver requires an EIN/Tax ID or equivalent, a D-U-N-S number, legal entity status, and free apps only). An organisation Google account avoids the personal-account 12-tester rule.

## Data model (Postgres)

```
profiles   id (= auth.users.id), name, role ('admin' | 'volunteer')
sites      id, name, address, lat, lng, contact, contact_email, notes,
           priority ('low'|'medium'|'urgent', nullable),
           last_visit date (derived/updated by trigger on visits), created_at
visits     id, site_id -> sites, date, priority_at_visit, work_carried_out,
           notes, logged_by -> profiles, legacy_logged_by text, created_at
visit_photos  id, visit_id -> visits, storage_path, created_at
jobs       id, site_id -> sites, text, done bool, due_date null,
           created_by, completed_by, created_at
stock_items  id, name, quantity int, unit, low_at int, kept_at, notes
```

Rules:
- A new visit sets `sites.priority` and `sites.last_visit` (only if the visit date is the newest).
- RLS: any signed-in user can read everything and insert visits/jobs/photos and update stock quantities; only admins can add/delete sites, delete visits, and manage users.
- `legacy_logged_by` keeps the free-text names from the Base44 data ("Thomas Woodward", "Ryan Gaffney", "Beth Rose", "Titus Jones", "tommysocietree"); map to real profiles once people sign up.
- The Base44 export has only a **photo count** per visit, not the images. Import it into `visits.legacy_photo_count` and show "📷 N photos (from old app)". The original images need to be downloaded from Base44 separately if the team wants them.

## Screens (match the prototype)

1. **Today:** four stat tiles (Urgent, Overdue, Open jobs, Low stock); "Needs attention" list of sites sorted by score; "Running low" stock list.
   - Overdue = no visit in 35+ days, or never visited. Make the threshold a setting.
   - Score = urgent (300) + medium (200) + overdue (100) + 10 per open job + a little extra for days since last visit.
2. **Sites:** searchable list sorted by score, "+ Site" button. **Site detail:** priority dot, address/contact, "Directions" (opens maps app), jobs checklist (add/tick), visit history with photos.
3. **Log visit** (floating button): site, date, priority now, work carried out, notes, photos (camera or gallery, compress client-side before upload).
4. **Stock:** list with +/- quantity buttons, low-stock items highlighted and sorted first, filter All / Low, add item.
5. **Map** (new): all sites as pins coloured by priority/overdue, tap for site card. Capture GPS for a site from the phone on a visit ("Set location to here").
6. **Auth:** email magic link or email+password via Supabase; first user becomes admin.

Design: dark-green header (#0F241C), accent green (#1f7a4d), urgent #c0392b, medium #d9822b, low #2e8b57; system font; large tap targets; bottom tab bar; supports light and dark mode.

## Suggested build order

1. Scaffold Expo + TypeScript + Expo Router; create the GitHub repo; add a short README and this file.
2. Supabase project, SQL migrations for the schema and RLS, seed script that loads `seed/societree-seed-data.json` (sites first, then visits by `site_id` slug, then stock).
3. Auth + profiles + roles.
4. Today, Sites, Site detail, Log visit (with photo upload to Supabase Storage).
5. Stock and Jobs.
6. Map + GPS capture.
7. PWA polish (manifest, icons, install prompt, caching) and deploy the web build to Cloudflare Pages/Vercel; give the team the link.
8. EAS Build for Android, then the Play Store listing; iOS if the waiver works out.

Keep the app small. Avoid adding features (reports, notifications, charts) until the team is using the basics.

## Current data snapshot (as of 2026-11-17)

**Sites (22)**, with last visit and priority:

| Site | Priority | Last visit | Notes |
|---|---|---|---|
| Manor Primary (Ivybridge, Devon) | urgent | 2026-10-22 | Contains a to-do style list (40 round logs, 16m + 22m pathway logs, mulch bags, 2 cardboard bundles); better modelled as jobs |
| Leigham | urgent | 2026-10-15 | 5 peripheral trees dead; someone strimmed the forest, killing ~20-30% of trees; top-up planting needed |
| Beaumont park (PL4) | medium | 2026-11-05 | |
| Marine Academy | medium | 2026-10-08 | Some trees didn't survive summer; top-ups needed |
| Plaistow | medium | 2026-10-21 | 5 dead peripheral trees (mixed species); replacements and strimming needed |
| Dartmoor zoo (Plymouth PL7 5DG, zoobase@dartmoorzoo.co.uk) | low | 2026-09-16 | Welding gloves, nail gun and basic tools kept at site |
| St Matthew's | low | 2026-11-04 | Fence sagging/tighten; gaps need topping up |
| Manadon Vale | low | 2026-10-08 | Brambles in corner to clear |
| Oreston | low | 2026-11-03 | Sparse; dogwoods destroyed; hay top-up may help |
| Sherford | low | 2026-10-21 | Weeds/grass between trees; ~10 peripheral dogwood dead; need a weed-suppression method |
| YMCA | low | 2026-10-21 | Bindweed present (was medium) |
| Mountwise | low | 2026-10-06 | More mulch needed in circle |
| St Paul's | low | 2026-11-11 | Needs strimming; monitor weeds and peripheral trees |
| Marlborough | low | 2026-11-04 | |
| Old Priory | low | 2026-11-04 | Pre-winter inspection: great growth |
| Elburton | low | 2026-11-03 | |
| Mary Deans | low | 2026-11-05 | New sign installed |
| Monkerton, Mount Street, St Joseph's, Wembury, Lipson Vale | none | never | No visits logged yet |

Only Manor Primary, Dartmoor zoo and Beaumont park have an address, and only the zoo has a contact email. No site has coordinates yet.

**Stock (24 items)**, mostly kept in the Polytunnel (wooden paling is in the Van; fence posts and work gloves are in the Store). Currently below their low-stock level:
- Fence posts: 0 (low at 12)
- Tree water bags: 2 (low at 10)
- Work gloves: 3 pairs (low at 10)
- Water saving gel: 1 bag (low at 2)

Also zero but with no threshold: Biochar (0 kg).

**People who log visits:** Thomas Woodward, Ryan Gaffney, Beth Rose, Titus Jones, and the username "tommysocietree".

## Data quirks to handle in the seed script

- Some visits are really single observations ("Presence of bindweed") and several sites have multiple visits on one day (YMCA 3, Plaistow 2, Manor Primary 2). Keep them as separate visits.
- Site-level `priority` in the CSV is blank for never-visited sites; store as NULL.
- `Date` on Site rows in the CSV is the last-visit date; the seed JSON already stores it as `last_visit` (computed from the visits).
- Unit values are inconsistent or empty ("", "item", "each", "20 litres", "20m²"). Keep as free text for now.
- Visit text contains line breaks; preserve them.

## First prompt to give Claude Code

> Read CLAUDE.md, open prototype/societree-prototype.html as the UI reference, and use seed/societree-seed-data.json as the data. Set up the Expo + Supabase project described in CLAUDE.md and work through the build order, one step at a time. Start with steps 1 and 2 (scaffold, schema, RLS and seed script), then show me what to run and what you need from me (Supabase project URL and keys, GitHub repo name).
