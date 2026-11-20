-- Sending a purchase request.
--
-- Buyers cannot write to purchase_requests directly (they only have SELECT).
-- A request is created by send_purchase_request(), which locks the listing row
-- first (the lock order every request function follows: listing, then request),
-- re-checks approval and state on the server, validates the meetup in Manila
-- time and records the price the buyer saw.

-- The price the buyer saw when sending. Older rows get the listing's price.
alter table public.purchase_requests add column price_seen numeric(10,2);
update public.purchase_requests r
set price_seen = l.price
from public.listings l
where l.id = r.listing_id;
alter table public.purchase_requests
  alter column price_seen set not null,
  add constraint purchase_requests_price_seen_check check (price_seen > 0);

-- Meetup places are descriptions of spots on campus. The list is a table so the
-- team can change it in the Supabase dashboard without a code change. The names
-- are plain descriptions: none is an official or guaranteed-safe location.
create table public.meetup_places (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(trim(name)) between 2 and 100),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

alter table public.meetup_places enable row level security;
revoke all on public.meetup_places from anon, authenticated;
grant select on public.meetup_places to authenticated;

create policy "Approved members can read the meetup places"
on public.meetup_places for select to authenticated
using ((select public.current_user_is_approved()));

insert into public.meetup_places (name, sort_order) values
  ('Library entrance, in the open area', 1),
  ('Canteen seating area', 2),
  ('Engineering building lobby', 3),
  ('Student lounge, ground floor', 4),
  ('Main gate waiting area', 5);

create function public.send_purchase_request(
  target_listing_id bigint,
  request_note text,
  place text,
  meetup_time timestamptz
)
returns public.purchase_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.listings;
  clean_note text := nullif(trim(coalesce(request_note, '')), '');
  clean_place text := trim(coalesce(place, ''));
  local_time time;
  created public.purchase_requests;
begin
  if not public.current_user_is_approved() then
    raise exception 'Only approved members can send requests.'
      using errcode = '42501';
  end if;

  select * into target
  from public.listings
  where id = target_listing_id
  for update;

  if not found then
    raise exception 'This listing was not found.' using errcode = 'P0002';
  end if;
  if target.seller_id = auth.uid() then
    raise exception 'You cannot request your own item.' using errcode = 'P0001';
  end if;
  if target.status <> 'active' then
    raise exception 'This item is no longer available for requests.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.purchase_requests
    where listing_id = target.id and buyer_id = auth.uid()
  ) then
    raise exception 'You already sent a request for this item. Each buyer can send one request per item, even after it was declined or cancelled.'
      using errcode = 'P0001';
  end if;

  if clean_note is not null and char_length(clean_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.meetup_places where name = clean_place and is_active
  ) then
    raise exception 'Choose one of the listed meetup places.' using errcode = 'P0001';
  end if;

  -- The meetup is checked as Manila time: in the future, within 30 days, and
  -- between 7:00 and 20:00 local time.
  if meetup_time is null or meetup_time <= now() then
    raise exception 'The meetup time must be in the future.' using errcode = 'P0001';
  end if;
  if meetup_time > now() + interval '30 days' then
    raise exception 'Choose a meetup within the next 30 days.' using errcode = 'P0001';
  end if;
  local_time := (meetup_time at time zone 'Asia/Manila')::time;
  if local_time < time '07:00' or local_time > time '20:00' then
    raise exception 'Choose a meetup time between 7:00 AM and 8:00 PM (Manila time).'
      using errcode = 'P0001';
  end if;

  insert into public.purchase_requests (listing_id, buyer_id, note, meetup_place, meetup_at, price_seen)
  values (target.id, auth.uid(), clean_note, clean_place, meetup_time, target.price)
  returning * into created;

  return created;
end;
$$;

grant execute on function public.send_purchase_request(bigint, text, text, timestamptz) to authenticated;
