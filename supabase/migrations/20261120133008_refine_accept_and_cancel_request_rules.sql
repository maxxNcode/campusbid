-- Review fixes for accepting and cancelling requests.
--
-- accept: a pending request whose meetup time has already passed is refused.
-- cancel: only an accepted request needs a reason (the buyer's pending cancel
--   does not), and cancelling an accepted request now raises if the listing is
--   not reserved instead of silently skipping the reopen.

create or replace function public.accept_purchase_request(target_request_id bigint)
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
  if target.meetup_at <= now() then
    raise exception 'The meetup time for this request has already passed, so it cannot be accepted. Decline it and ask the buyer for new times.'
      using errcode = 'P0001';
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

create or replace function public.cancel_purchase_request(target_request_id bigint, cancel_reason text)
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

  -- A reason is required for an accepted arrangement; a pending request can be
  -- cancelled without one, but a reason that is given must still be valid.
  if was_accepted and char_length(clean_reason) < 3 then
    raise exception 'Give a short reason (at least 3 characters).' using errcode = 'P0001';
  end if;
  if clean_reason <> '' and char_length(clean_reason) < 3 then
    raise exception 'Give a short reason (at least 3 characters), or leave it empty.' using errcode = 'P0001';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = 'P0001';
  end if;

  -- An accepted request always has a reserved listing. If not, something is
  -- wrong, so stop instead of leaving the two out of step.
  if was_accepted and target_listing.status <> 'reserved' then
    raise exception 'The listing is not reserved, so this arrangement cannot be cancelled.' using errcode = 'P0001';
  end if;

  update public.purchase_requests
  set status = 'cancelled', closed_at = now(), closed_reason = nullif(clean_reason, '')
  where id = target.id
  returning * into target;

  -- Cancelling an accepted arrangement reopens the listing. Requests that were
  -- declined when it was accepted stay declined.
  if was_accepted then
    update public.listings set status = 'active' where id = target_listing.id;
  end if;

  return target;
end;
$$;
