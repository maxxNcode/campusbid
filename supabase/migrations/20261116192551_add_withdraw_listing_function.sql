-- A seller withdraws their own available listing.
--
-- Runs as one transaction. The listing row is locked first (the lock order
-- every listing transition will follow: listing, then its requests), its
-- status is checked again on the server, and pending requests on it are
-- cancelled with a reason. Nothing is deleted, so the request history stays.

create function public.withdraw_listing(target_listing_id bigint)
returns public.listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.listings;
begin
  if not public.current_user_is_approved() then
    raise exception 'Only approved members can withdraw listings.'
      using errcode = '42501';
  end if;

  select * into target
  from public.listings
  where id = target_listing_id
  for update;

  if not found or target.seller_id is distinct from auth.uid() then
    raise exception 'Listing not found, or it is not yours.'
      using errcode = '42501';
  end if;

  if target.status <> 'active' then
    raise exception 'Only an available listing can be withdrawn.'
      using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set status = 'cancelled',
      closed_at = now(),
      closed_reason = 'The seller withdrew the listing.'
  where listing_id = target.id
    and status = 'pending';

  update public.listings
  set status = 'withdrawn'
  where id = target.id
  returning * into target;

  return target;
end;
$$;

grant execute on function public.withdraw_listing(bigint) to authenticated;
