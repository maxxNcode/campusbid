-- Access rules. The browser is untrusted: every table has Row Level Security,
-- clients get only the column privileges they need, and approval changes go
-- through review_account(), which checks the caller is an approved admin.

-- Helper checks used by policies. SECURITY DEFINER lets them read profiles
-- without recursing into the profiles policies.
create or replace function public.current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved' and is_admin
  );
$$;

-- Every new auth user gets a pending, non-admin profile. Only the name, program
-- and year level are taken from the sign-up form; admin and approval values in
-- the submitted metadata are ignored.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, program, year_level)
  values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'program', '')),
    (new.raw_user_meta_data ->> 'year_level')::smallint
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Stops signed-in users from approving themselves or making themselves admin
-- with a direct table update. Column privileges already block this; the trigger
-- is a second, explicit guard. review_account() runs as the function owner, and
-- seed scripts run as service_role, so neither is affected.
create or replace function public.protect_profile_review_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.id is distinct from old.id
    or new.is_admin is distinct from old.is_admin
    or new.approval_status is distinct from old.approval_status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Approval and admin fields can only be changed by an admin review'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_review_fields
before update on public.profiles
for each row execute function public.protect_profile_review_fields();

-- Admin decision on a pending account. Records the reviewer and the time.
create or replace function public.review_account(
  target_profile_id uuid,
  decision public.approval_status
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not public.current_user_is_admin() then
    raise exception 'Only an approved admin can review accounts' using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  if target_profile_id = auth.uid() then
    raise exception 'Admins cannot review their own account' using errcode = '42501';
  end if;

  -- Lock the row so two admins clicking at once cannot both review it.
  select * into target from public.profiles where id = target_profile_id for update;

  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if target.approval_status <> 'pending' then
    raise exception 'This account has already been reviewed' using errcode = '55000';
  end if;

  update public.profiles
  set approval_status = decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = target_profile_id
  returning * into target;

  return target;
end;
$$;

-- Pending applicants with their sign-in email, for the admin approval page.
create or replace function public.pending_accounts()
returns table (
  id uuid,
  email text,
  full_name text,
  program text,
  year_level smallint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Only an approved admin can list pending accounts' using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.program, p.year_level, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.approval_status = 'pending'
    order by p.created_at;
end;
$$;

-- Privileges: anonymous visitors get nothing; signed-in users may read, and may
-- update only the descriptive columns of their own profile. Listing and request
-- writes are added with their features, through policies and functions.
revoke all on public.profiles, public.categories, public.listings, public.purchase_requests
  from anon, authenticated;
grant select on public.profiles, public.categories, public.listings, public.purchase_requests
  to authenticated;
grant update (full_name, program, year_level) on public.profiles to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_user_is_approved() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.review_account(uuid, public.approval_status) to authenticated;
grant execute on function public.pending_accounts() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.purchase_requests enable row level security;

-- Profiles: your own row, every row for admins, and approved members' rows for
-- other approved members (needed later to show seller names).
create policy "Profiles are visible to their owner, admins and approved members"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_approved()) and approval_status = 'approved')
);

create policy "Users can update their own profile details"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Signed-in users can read categories"
on public.categories for select to authenticated
using (true);

-- Browsing is for approved members only. Sold and withdrawn listings stay
-- visible to their seller for their history.
create policy "Approved members can read open listings and their own"
on public.listings for select to authenticated
using (
  (select public.current_user_is_approved())
  and (status in ('active', 'reserved') or seller_id = (select auth.uid()))
);

-- A request is private to its buyer and the listing's seller.
create policy "Requests are visible to their buyer and the listing seller"
on public.purchase_requests for select to authenticated
using (
  (select public.current_user_is_approved())
  and (
    buyer_id = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = (select auth.uid())
    )
  )
);
