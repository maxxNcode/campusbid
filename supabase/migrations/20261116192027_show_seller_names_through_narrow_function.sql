-- Seller names on listings without exposing whole profile rows.
--
-- Until now any approved member could select every approved member's full
-- profile row, including is_admin and the review columns (Day 1 review,
-- minor item 5). Members now read only their own row (admins still read all),
-- and other members' names come from member_names(), which returns the id and
-- full name of approved members and nothing else.

drop policy "Profiles are visible to their owner, admins and approved members" on public.profiles;

create policy "Profiles are visible to their owner and admins"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create function public.member_names(member_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any (member_ids)
    and p.approval_status = 'approved'
    and public.current_user_is_approved()
  limit 100
$$;

grant execute on function public.member_names(uuid[]) to authenticated;
