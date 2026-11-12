-- A buyer keeps seeing a listing they sent a request for, even after it is
-- sold or withdrawn, so "My requests" can still show the item's title and price.
--
-- The check runs in a SECURITY DEFINER function. A policy on listings that
-- queried purchase_requests directly would recurse, because the
-- purchase_requests policy already queries listings.
create or replace function public.current_user_has_request_on(target_listing_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.purchase_requests
    where listing_id = target_listing_id and buyer_id = auth.uid()
  );
$$;

revoke execute on function public.current_user_has_request_on(bigint) from public, anon;
grant execute on function public.current_user_has_request_on(bigint) to authenticated;

create policy "Buyers can read listings they have requested"
on public.listings for select to authenticated
using (
  (select public.current_user_is_approved())
  and public.current_user_has_request_on(id)
);
