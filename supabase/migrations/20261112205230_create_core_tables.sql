-- Core CampusBid tables: profiles, categories, listings and purchase requests.
-- Times are stored as timestamptz (UTC) and displayed in Asia/Manila by the app.

create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.listing_status as enum ('active', 'reserved', 'sold', 'withdrawn');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'completed');
create type public.item_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One profile per Supabase auth user. The email and password hash stay in auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  program text not null check (char_length(trim(program)) between 2 and 100),
  year_level smallint not null check (year_level between 1 and 5),
  is_admin boolean not null default false,
  approval_status public.approval_status not null default 'pending',
  -- Who reviewed the student-status application and when (approved or rejected).
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_review_recorded check (
    approval_status = 'pending' or reviewed_at is not null
  )
);

create index profiles_approval_status_idx on public.profiles (approval_status, created_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(trim(name)) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  category_id bigint not null references public.categories (id) on delete restrict,
  program text not null check (char_length(trim(program)) between 2 and 100),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 10 and 2000),
  price numeric(10, 2) not null check (price > 0),
  condition public.item_condition not null,
  model_or_edition text check (char_length(model_or_edition) <= 200),
  included_parts text check (char_length(included_parts) <= 1000),
  -- Required disclosure. Sellers write "None known" when there are no defects.
  known_defects text not null check (char_length(trim(known_defects)) between 2 and 1000),
  photo_path text check (char_length(photo_path) <= 300),
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_category_idx on public.listings (category_id);
create index listings_program_idx on public.listings (program);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

-- The seller is the listing owner, so seller_id is not repeated here.
create table public.purchase_requests (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings (id) on delete restrict,
  buyer_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  note text check (char_length(note) <= 500),
  status public.request_status not null default 'pending',
  meetup_place text not null check (char_length(trim(meetup_place)) between 2 and 200),
  meetup_at timestamptz not null,
  accepted_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  -- Reason given when a request is declined or cancelled.
  closed_reason text check (char_length(closed_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One lifetime request per buyer per listing in this release.
  constraint purchase_requests_one_per_buyer unique (listing_id, buyer_id),
  constraint purchase_requests_accepted_time check (
    status not in ('accepted', 'completed') or accepted_at is not null
  ),
  constraint purchase_requests_completed_time check (
    status <> 'completed' or completed_at is not null
  ),
  constraint purchase_requests_closed_time check (
    status not in ('declined', 'cancelled') or closed_at is not null
  )
);

-- Last line of defence against double reservation: a listing can have at most
-- one accepted or completed request at any time.
create unique index purchase_requests_one_accepted_idx
  on public.purchase_requests (listing_id)
  where status in ('accepted', 'completed');

create index purchase_requests_buyer_idx on public.purchase_requests (buyer_id, created_at desc);
create index purchase_requests_listing_status_idx on public.purchase_requests (listing_id, status);

create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row execute function public.set_updated_at();
