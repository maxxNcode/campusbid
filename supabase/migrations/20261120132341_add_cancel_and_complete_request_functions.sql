-- Cancelling and completing a purchase request. Same lock order as accept and
-- decline: the listing row first, then the request, then re-check everything.

create function public.cancel_purchase_request(target_request_id bigint, cancel_reason text)
returns public.purchase_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_key bigint;
  target_listing public.listings;
  target public.purchase_requests;
  clean_reason text := trim(coalesce(cancel_reason, ''));
  was_accepted boolean;
begin
  if not public.current_user_is_approved() then
    raise exception 'Only approved members can cancel requests.' using errcode = '42501';
  end if;

  select listing_id into listing_key from public.purchase_requests where id = target_request_id;
  if not found then
    raise exception 'Request not found, or it is not yours.' using errcode = '42501';
  end if;

  select * into target_listing from public.listings where id = listing_key for update;
  select * into target from public.purchase_requests where id = target_request_id for update;

  if target.buyer_id is distinct from auth.uid() and target_listing.seller_id is distinct from auth.uid() then
    raise exception 'Request not found, or it is not yours.' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 3 then
    raise exception 'Give a short reason (at least 3 characters).' using errcode = 'P0001';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = 'P0001';
  end if;

  if target.buyer_id = auth.uid() then
    if target.status not in ('pending', 'accepted') then
      raise exception 'This request can no longer be cancelled. It is now %.', target.status using errcode = 'P0001';
    end if;
  else
    -- The seller cancels an accepted arrangement; a pending request is declined instead.
    if target.status <> 'accepted' then
      raise exception 'You can cancel only an accepted request. It is now %.', target.status using errcode = 'P0001';
    end if;
  end if;

  was_accepted := target.status = 'accepted';

  update public.purchase_requests
  set status = 'cancelled', closed_at = now(), closed_reason = clean_reason
  where id = target.id
  returning * into target;

  -- Cancelling an accepted arrangement reopens the listing. Requests that were
  -- declined when it was accepted stay declined.
  if was_accepted and target_listing.status = 'reserved' then
    update public.listings set status = 'active' where id = target_listing.id;
  end if;

  return target;
end;
$$;

grant execute on function public.cancel_purchase_request(bigint, text) to authenticated;

create function public.complete_purchase_request(target_request_id bigint)
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
    raise exception 'Only approved members can complete requests.' using errcode = '42501';
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
  if target.status <> 'accepted' then
    raise exception 'Only an accepted request can be completed. This one is %.', target.status using errcode = 'P0001';
  end if;
  if target_listing.status <> 'reserved' then
    raise exception 'The listing is not reserved, so this request cannot be completed.' using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set status = 'completed', completed_at = now()
  where id = target.id
  returning * into target;

  update public.listings set status = 'sold' where id = target_listing.id;

  return target;
end;
$$;

grant execute on function public.complete_purchase_request(bigint) to authenticated;
