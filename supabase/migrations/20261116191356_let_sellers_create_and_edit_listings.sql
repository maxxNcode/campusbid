-- Phase 2: approved members can create listings and edit their own active
-- listings, and listing photos go to a private Storage bucket.
--
-- Clients get column-level grants for the descriptive fields only. seller_id
-- comes from its default (auth.uid()) and status from its default ('active');
-- neither column is granted, so a client cannot send them at all. Status
-- changes happen only through database functions.

grant insert (
  category_id, program, title, description, price, condition,
  model_or_edition, included_parts, known_defects, photo_path
) on public.listings to authenticated;

grant update (
  category_id, program, title, description, price, condition,
  model_or_edition, included_parts, known_defects, photo_path
) on public.listings to authenticated;

-- A photo path must sit in the seller's own folder of the photo bucket, so a
-- listing cannot point at another member's upload.
create function public.listing_photo_path_is_own(path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select path is null or split_part(path, '/', 1) = (select auth.uid())::text
$$;

grant execute on function public.listing_photo_path_is_own(text) to authenticated;

create policy "Approved members can create their own listings"
on public.listings for insert to authenticated
with check (
  (select public.current_user_is_approved())
  and seller_id = (select auth.uid())
  and status = 'active'
  and public.listing_photo_path_is_own(photo_path)
);

-- Only active listings are editable. Reserved, sold and withdrawn listings
-- stay as they were agreed or closed.
create policy "Sellers can edit their own active listings"
on public.listings for update to authenticated
using (
  (select public.current_user_is_approved())
  and seller_id = (select auth.uid())
  and status = 'active'
)
with check (
  (select public.current_user_is_approved())
  and seller_id = (select auth.uid())
  and status = 'active'
  and public.listing_photo_path_is_own(photo_path)
);

-- Listing photos. The bucket is private: files are served only through
-- signed URLs to signed-in members who pass the read policy below. Storage
-- itself enforces the size limit (5 MB) and the allowed image types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Approved members can view listing photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-photos'
  and (select public.current_user_is_approved())
);

-- Uploads go into a folder named after the uploader, under a generated name:
-- <user id>/<random uuid>.<jpg|png|webp>. Any other name is refused.
create policy "Approved members can upload listing photos to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-photos'
  and (select public.current_user_is_approved())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
);

-- Sellers may remove their own uploads, for example a replaced photo.
create policy "Members can delete their own listing photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
