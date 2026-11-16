-- Keep the photo a listing shows, and require a photo on new listings.
--
-- Before this, a seller could delete any file in their own folder, including
-- the photo of a reserved or sold listing, which changes the item after it was
-- agreed. Now a photo can only be deleted once no listing points at it: a
-- replaced photo (the listing already points at the new one) or an upload
-- whose listing failed to save. Replacing the photo of a reserved, sold or
-- withdrawn listing was already blocked, because only active listings can be
-- edited, and Storage has no update policy, so files cannot be overwritten.

create function public.listing_photo_in_use(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.listings where photo_path = path)
$$;

grant execute on function public.listing_photo_in_use(text) to authenticated;

drop policy "Members can delete their own listing photos" on storage.objects;

create policy "Members can delete their own unused listing photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.listing_photo_in_use(name)
);

-- The form always required a photo; now the database does too. NOT VALID keeps
-- any earlier row without a photo, but every new or edited row must have one.
alter table public.listings
  add constraint listings_photo_required check (photo_path is not null) not valid;
