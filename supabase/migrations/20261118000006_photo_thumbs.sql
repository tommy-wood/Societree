-- Small preview image for each visit photo (about 400 px, a few KB), so visit
-- history doesn't download full-size photos. Older photos have no preview and
-- the app falls back to the full image.
alter table public.visit_photos add column thumb_path text unique;
