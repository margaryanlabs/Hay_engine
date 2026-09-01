-- Apply after creating the private `hay-assets` Storage bucket in the dedicated HAY Supabase project.
-- The app uploads to: <auth.uid()>/<yyyy-mm-dd>/<uuid>.<ext>

alter table storage.objects enable row level security;

create policy "hay asset owners select"
on storage.objects for select to authenticated
using (bucket_id = 'hay-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hay asset owners insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'hay-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hay asset owners update"
on storage.objects for update to authenticated
using (bucket_id = 'hay-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'hay-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "hay asset owners delete"
on storage.objects for delete to authenticated
using (bucket_id = 'hay-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
