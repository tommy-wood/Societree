-- Societree Forest Care: photo storage.
-- Private bucket; the app reads photos through signed URLs.
-- Path convention: <visit_id>/<random>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-photos',
  'visit-photos',
  false,
  10 * 1024 * 1024,   -- 10 MB; the app compresses well below this
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "visit-photos: signed-in users can view"
  on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos');

create policy "visit-photos: signed-in users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos');

create policy "visit-photos: uploader or admin can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'visit-photos'
    and (owner_id = (select auth.uid())::text or (select public.is_admin()))
  );
