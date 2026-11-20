-- Accepting and declining a purchase request.
--
-- One lock order for every request function: the listing row first, then the
-- request. Each function peeks at the request to find its listing (no lock),
-- locks that listing with FOR UPDATE, then locks and re-reads the request and
-- checks approval, ownership and current state again. Two sellers' clicks, or
-- one replayed click, queue on the listing lock; the one that comes second sees
-- the new state and gets a clear message instead of changing anything.

create function public.accept_purchase_request(target_request_id bigint)
returns public.purchase_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_key bigint;
  target_listing public.listings;
  target public.purchase_requests;
begin
  if not public.current_user_is_approved() then
    raise exception 'Only approved members can answer requests.' using errcode = '42501';
  end if;

  select listing_id into listing_key from public.purchase_requests where id = target_request_id;
  if not found then
    raise exception 'Request not found, or it is not for your listing.' using errcode = '42501';
  end if;

  select * into target_listing from public.listings where id = listing_key for update;
  select * into target from public.purchase_requests where id = target_request_id for update;

  if target_listing.seller_id is distinct from auth.uid() then
    raise exception 'Request not found, or it is not for your listing.' using errcode = '42501';
  end if;
  if target.status <> 'pending' then
    raise exception 'This request is no longer pending. It is now %.', target.status using errcode = 'P0001';
  end if;
  if target_listing.status <> 'active' then
    raise exception 'This item is no longer available, so no request can be accepted.' using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set status = 'accepted', accepted_at = now()
  where id = target.id
  returning * into target;

  update public.purchase_requests
  set status = 'declined',
      closed_at = now(),
      closed_reason = 'The item is no longer available: the seller accepted another request.'
  where listing_id = target_listing.id
    and status = 'pending'
    and id <> target.id;

  update public.listings set status = 'reserved' where id = target_listing.id;

  return target;
end;
$$;

grant execute on function public.accept_purchase_request(bigint) to authenticated;

create function public.decline_purchase_request(target_request_id bigint, decline_reason text)
returns public.purchase_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_key bigint;
  target_listing public.listings;
  target public.purchase_requests;
  clean_reason text := nullif(trim(coalesce(decline_reason, '')), '');
begin
  if not public.current_user_is_approved() then
    raise exception 'Only approved members can answer requests.' using errcode = '42501';
  end if;

  select listing_id into listing_key from public.purchase_requests where id = target_request_id;
  if not found then
    raise exception 'Request not found, or it is not for your listing.' using errcode = '42501';
  end if;

  select * into target_listing from public.listings where id = listing_key for update;
  select * into target from public.purchase_requests where id = target_request_id for update;

  if target_listing.seller_id is distinct from auth.uid() then
    raise exception 'Request not found, or it is not for your listing.' using errcode = '42501';
  end if;
  if target.status <> 'pending' then
    raise exception 'This request is no longer pending. It is now %.', target.status using errcode = 'P0001';
  end if;
  if clean_reason is not null and char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set status = 'declined',
      closed_at = now(),
      closed_reason = clean_reason
  where id = target.id
  returning * into target;

  return target;
end;
$$;

grant execute on function public.decline_purchase_request(bigint, text) to authenticated;
