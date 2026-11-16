-- Access-rule assertions for tests/offline/run-sql-checks.mjs. Each block starts
-- with "-- CHECK <title>". A block passes when its last query returns pass = true,
-- or, for titles marked [error], when it raises an error. Users are fictional.

-- CHECK setup users through auth trigger
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', '{"full_name":"Admin","program":"BS Information Technology","year_level":4}'),
 ('00000000-0000-0000-0000-00000000000b', 'buyer@example.test', '{"full_name":"Buyer","program":"BS Civil Engineering","year_level":1}'),
 ('00000000-0000-0000-0000-00000000000c', 'seller@example.test', '{"full_name":"Seller","program":"BS Information Technology","year_level":4}'),
 ('00000000-0000-0000-0000-00000000000d', 'pending@example.test', '{"full_name":"Pending","program":"BS Mechanical Engineering","year_level":3,"is_admin":true,"approval_status":"approved"}');
set role service_role;
update public.profiles set approval_status='approved', is_admin=true, reviewed_at=now() where id='00000000-0000-0000-0000-00000000000a';
update public.profiles set approval_status='approved', reviewed_by='00000000-0000-0000-0000-00000000000a', reviewed_at=now() where id in ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000c');
insert into public.categories (name, slug) values ('Calculators','calculators');
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects, photo_path)
 values ('00000000-0000-0000-0000-00000000000c', 1, 'BS Information Technology', 'Casio fx-991ES', 'Scientific calculator, works well', 650.00, 'good', 'None known',
         '00000000-0000-0000-0000-00000000000c/55555555-5555-5555-5555-555555555555.jpg');
reset role;
select (select count(*) from public.profiles) = 4 as pass;

-- CHECK metadata cannot make a new user admin or approved
select (is_admin = false and approval_status = 'pending') as pass from public.profiles where id='00000000-0000-0000-0000-00000000000d';

-- CHECK approved buyer sees the active listing
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from public.listings;

-- CHECK pending user sees no listings
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 0 as pass from public.listings;

-- CHECK pending user sees only own profile
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 1 as pass from public.profiles;

-- CHECK anon reads nothing [error]
set role anon;
select * from public.profiles;

-- CHECK pending user cannot approve self by direct update [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
update public.profiles set approval_status='approved' where id='00000000-0000-0000-0000-00000000000d';

-- CHECK pending user cannot make self admin [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
update public.profiles set is_admin=true where id='00000000-0000-0000-0000-00000000000d';

-- CHECK pending user can edit own name
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
update public.profiles set full_name='Pending Renamed' where id='00000000-0000-0000-0000-00000000000d';
select full_name = 'Pending Renamed' as pass from public.profiles where id='00000000-0000-0000-0000-00000000000d';

-- CHECK buyer cannot rename another user (0 rows updated)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
update public.profiles set full_name='Hacked' where id='00000000-0000-0000-0000-00000000000c';
reset role;
select full_name = 'Seller' as pass from public.profiles where id='00000000-0000-0000-0000-00000000000c';

-- CHECK pending user cannot call review_account on self [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.review_account('00000000-0000-0000-0000-00000000000d','approved');

-- CHECK approved non-admin cannot call review_account [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.review_account('00000000-0000-0000-0000-00000000000d','approved');

-- CHECK non-admin cannot list pending accounts [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select * from public.pending_accounts();

-- CHECK pending user cannot insert listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path) values (1,'BS IT','Thing','A thing for sale here',10,'good','None','00000000-0000-0000-0000-00000000000d/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK admin lists pending accounts with email
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select count(*) = 1 and bool_and(email = 'pending@example.test') as pass from public.pending_accounts();

-- CHECK admin approves pending account and reviewer is recorded
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.review_account('00000000-0000-0000-0000-00000000000d','approved');
reset role;
select (approval_status='approved' and reviewed_by='00000000-0000-0000-0000-00000000000a' and reviewed_at is not null) as pass from public.profiles where id='00000000-0000-0000-0000-00000000000d';

-- CHECK reviewing twice is rejected [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.review_account('00000000-0000-0000-0000-00000000000d','rejected');

-- CHECK admin cannot review own account [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.review_account('00000000-0000-0000-0000-00000000000a','rejected');

-- CHECK negative price rejected [error]
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects, photo_path)
 values ('00000000-0000-0000-0000-00000000000c', 1, 'BS IT', 'Bad price', 'This has a negative price', -5, 'good', 'None known', '00000000-0000-0000-0000-00000000000c/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK trigger alone blocks self-approval even if a column grant is added by mistake [error]
reset role;
grant update (approval_status) on public.profiles to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e','p2@example.test','{"full_name":"Pending Two","program":"BS Civil Engineering","year_level":2}');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
update public.profiles set approval_status='approved' where id='00000000-0000-0000-0000-00000000000e';

-- CHECK buyer still sees a sold listing they requested; others do not
reset role;
set role service_role;
insert into public.purchase_requests (listing_id, buyer_id, meetup_place, meetup_at, status, accepted_at, completed_at)
 values (1, '00000000-0000-0000-0000-00000000000b', 'Library lobby', now() + interval '1 day', 'completed', now(), now());
update public.listings set status = 'sold' where id = 1;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from public.listings where id = 1;

-- CHECK approved member without a request cannot see the sold listing
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 0 as pass from public.listings where id = 1;

-- CHECK buyer reads own request joined to its sold listing without recursion
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from public.purchase_requests r join public.listings l on l.id = r.listing_id;

-- CHECK seller still sees own sold listing and the request on it
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select (select count(*) from public.listings where id = 1) = 1 and (select count(*) from public.purchase_requests) = 1 as pass;

-- CHECK setup a function created after the migrations
reset role;
create function public.later_rpc() returns int language sql as $$ select 1 $$;
select true as pass;

-- CHECK a function created after the migrations is not callable by anon [error]
set role anon;
select public.later_rpc();

-- CHECK a function created after the migrations is not callable by authenticated [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.later_rpc();

-- CHECK an explicit grant makes it callable by authenticated
reset role;
grant execute on function public.later_rpc() to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.later_rpc() = 1 as pass;

-- CHECK a new function in public has no EXECUTE for anon, authenticated or PUBLIC
reset role;
create function public.later_rpc_two() returns int language sql as $$ select 2 $$;
select not has_function_privilege('anon', 'public.later_rpc_two()', 'execute')
   and not has_function_privilege('authenticated', 'public.later_rpc_two()', 'execute')
   and not exists (select 1 from aclexplode((select proacl from pg_proc where proname = 'later_rpc_two')) a where a.grantee = 0)
   and has_function_privilege('service_role', 'public.later_rpc_two()', 'execute') as pass;

-- CHECK control: the default grants are live, so the checks above can fail
-- A function owned by supabase_admin is not covered by the postgres-only
-- default-privilege change, so the stand-in grants still reach anon.
reset role;
set role supabase_admin;
create function public.admin_owned_rpc() returns int language sql as $$ select 3 $$;
reset role;
select has_function_privilege('anon', 'public.admin_owned_rpc()', 'execute')
   and has_function_privilege('authenticated', 'public.admin_owned_rpc()', 'execute') as pass;

-- CHECK a pg_trgm index still serves the ilike search for signed-in users
-- The PUBLIC revoke also covers extension functions created by postgres. The
-- planned trigram index works, because index support functions need no EXECUTE.
reset role;
create extension pg_trgm;
create index listings_title_trgm on public.listings using gin (title public.gin_trgm_ops);
set enable_seqscan = off;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from public.listings where title ilike '%casio%';

-- CHECK calling a pg_trgm function directly needs an explicit grant
reset role;
set enable_seqscan = on;
select not has_function_privilege('authenticated', 'public.similarity(text,text)', 'execute') as pass;

-- CHECK clean up the pg_trgm test objects
reset role;
drop index public.listings_title_trgm;
drop extension pg_trgm;
drop function public.admin_owned_rpc();
drop function public.later_rpc_two();
select true as pass;

-- CHECK existing helper functions still work for signed-in users
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.current_user_is_approved() as pass;

-- Phase 2: listing writes and listing photos.
-- Users: b = approved buyer, c = approved seller, e = pending applicant.

-- CHECK setup a pending applicant for the listing checks
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000e','p2@example.test','{"full_name":"Pending Two","program":"BS Civil Engineering","year_level":2}');
select approval_status = 'pending' as pass from public.profiles where id = '00000000-0000-0000-0000-00000000000e';

-- CHECK seller creates a listing; seller and status come from the defaults
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path)
 values (1, 'BS Information Technology', 'Drafting set', 'Complete drafting set in a case', 450.50, 'good', 'One compass leg is loose',
         '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg');
select (seller_id = '00000000-0000-0000-0000-00000000000c' and status = 'active' and price = 450.50) as pass
 from public.listings where title = 'Drafting set';

-- CHECK a client cannot choose the seller of a new listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects, photo_path)
 values ('00000000-0000-0000-0000-00000000000c', 1, 'BS Civil Engineering', 'Posing as seller', 'Listing under another member', 10, 'good', 'None', '00000000-0000-0000-0000-00000000000b/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK a client cannot create a listing that is already sold [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.listings (status, category_id, program, title, description, price, condition, known_defects, photo_path)
 values ('sold', 1, 'BS Civil Engineering', 'Pre-sold', 'Listing that starts as sold', 10, 'good', 'None', '00000000-0000-0000-0000-00000000000b/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK a listing cannot point at another member's photo [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path)
 values (1, 'BS Civil Engineering', 'Borrowed photo', 'Uses the seller photo path', 10, 'good', 'None',
         '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg');

-- CHECK pending applicant still cannot create a listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path)
 values (1, 'BS Civil Engineering', 'Pending item', 'Listing from a pending user', 10, 'good', 'None', '00000000-0000-0000-0000-00000000000e/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK zero price rejected [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path)
 values (1, 'BS Information Technology', 'Free item', 'Price of zero pesos', 0, 'good', 'None', '00000000-0000-0000-0000-00000000000c/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK known defects are required [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects, photo_path)
 values (1, 'BS Information Technology', 'No disclosure', 'Defects left blank here', 50, 'good', ' ', '00000000-0000-0000-0000-00000000000c/77777777-7777-7777-7777-777777777777.jpg');

-- CHECK a listing without a photo is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects)
 values (1, 'BS Information Technology', 'No photo', 'Listing sent without a photo', 50, 'good', 'None');

-- CHECK an edit cannot remove the photo [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set photo_path = null where title = 'Drafting set';

-- CHECK buyer cannot edit the seller's listing (0 rows changed)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
update public.listings set price = 1 where title = 'Drafting set';
reset role;
select price = 450.50 as pass from public.listings where title = 'Drafting set';

-- CHECK seller edits own active listing
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set price = 400, known_defects = 'One compass leg is loose; eraser shield bent' where title = 'Drafting set';
select (price = 400.00 and updated_at >= created_at) as pass from public.listings where title = 'Drafting set';

-- CHECK seller cannot change status directly [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set status = 'sold' where title = 'Drafting set';

-- CHECK seller cannot hand a listing to another member [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set seller_id = '00000000-0000-0000-0000-00000000000b' where title = 'Drafting set';

-- CHECK seller cannot edit own sold listing (0 rows changed)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set price = 1 where id = 1;
reset role;
select price = 650.00 as pass from public.listings where id = 1;

-- CHECK photo bucket is private with a size limit and image types only
select (public = false and file_size_limit = 5242880
        and allowed_mime_types = array['image/jpeg','image/png','image/webp']) as pass
 from storage.buckets where id = 'listing-photos';

-- CHECK seller uploads a photo with a generated name into own folder
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg');
select count(*) = 1 as pass from storage.objects;

-- CHECK upload into another member's folder is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000c/22222222-2222-2222-2222-222222222222.jpg');

-- CHECK upload under a chosen file name is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000c/my-calculator.jpg');

-- CHECK upload with a non-image extension is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000c/33333333-3333-3333-3333-333333333333.exe');

-- CHECK pending applicant cannot upload [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000e/44444444-4444-4444-4444-444444444444.png');

-- CHECK approved buyer can see the photo
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from storage.objects;

-- CHECK pending applicant cannot see the photo
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select count(*) = 0 as pass from storage.objects;

-- CHECK anonymous visitor cannot see the photo
set role anon;
select count(*) = 0 as pass from storage.objects;

-- CHECK buyer cannot delete the seller's photo (0 rows)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
delete from storage.objects;
reset role;
select count(*) = 1 as pass from storage.objects;

-- CHECK seller cannot delete the photo of own active listing (0 rows)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
delete from storage.objects where name = '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg';
reset role;
select count(*) = 1 as pass from storage.objects
 where name = '00000000-0000-0000-0000-00000000000c/11111111-1111-1111-1111-111111111111.jpg';

-- CHECK seller cannot delete the photo of own sold listing (0 rows)
reset role;
insert into storage.objects (bucket_id, name) values ('listing-photos', '00000000-0000-0000-0000-00000000000c/55555555-5555-5555-5555-555555555555.jpg');
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
delete from storage.objects where name = '00000000-0000-0000-0000-00000000000c/55555555-5555-5555-5555-555555555555.jpg';
reset role;
select (select status from public.listings where id = 1) = 'sold'
   and (select count(*) from storage.objects where name = '00000000-0000-0000-0000-00000000000c/55555555-5555-5555-5555-555555555555.jpg') = 1 as pass;

-- CHECK seller cannot point a sold listing at a new photo (0 rows changed)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set photo_path = '00000000-0000-0000-0000-00000000000c/66666666-6666-6666-6666-666666666666.jpg' where id = 1;
reset role;
select photo_path = '00000000-0000-0000-0000-00000000000c/55555555-5555-5555-5555-555555555555.jpg' as pass from public.listings where id = 1;

-- CHECK seller can delete an own upload that no listing uses
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into storage.objects (bucket_id, name) values
 ('listing-photos', '00000000-0000-0000-0000-00000000000c/88888888-8888-8888-8888-888888888888.png');
delete from storage.objects where name = '00000000-0000-0000-0000-00000000000c/88888888-8888-8888-8888-888888888888.png';
reset role;
select count(*) = 0 as pass from storage.objects
 where name = '00000000-0000-0000-0000-00000000000c/88888888-8888-8888-8888-888888888888.png';

-- CHECK approved buyer can no longer read the seller's profile row
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 0 as pass from public.profiles where id = '00000000-0000-0000-0000-00000000000c';

-- CHECK approved buyer still reads own profile row
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from public.profiles;

-- CHECK admin still reads every profile row
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select count(*) = 5 as pass from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_';

-- CHECK member_names gives an approved buyer the seller's name and nothing else
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 and bool_and(full_name = 'Seller') as pass
 from public.member_names(array['00000000-0000-0000-0000-00000000000c']::uuid[]);

-- CHECK member_names returns only the id and full name columns
reset role;
select pg_get_function_result('public.member_names(uuid[])'::regprocedure) = 'TABLE(id uuid, full_name text)' as pass;

-- CHECK member_names does not name pending applicants
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 0 as pass from public.member_names(array['00000000-0000-0000-0000-00000000000e']::uuid[]);

-- CHECK member_names gives a pending applicant nothing
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select count(*) = 0 as pass from public.member_names(array['00000000-0000-0000-0000-00000000000c']::uuid[]);

-- CHECK member_names is not callable by anon [error]
set role anon;
select * from public.member_names(array['00000000-0000-0000-0000-00000000000c']::uuid[]);

-- Phase 2: withdrawing a listing.

-- CHECK setup a pending request on the seller's drafting set
reset role; set role service_role;
insert into public.purchase_requests (listing_id, buyer_id, meetup_place, meetup_at)
 select id, '00000000-0000-0000-0000-00000000000b', 'Library lobby', now() + interval '2 days'
 from public.listings where title = 'Drafting set';
reset role;
select count(*) = 1 as pass from public.purchase_requests where status = 'pending';

-- CHECK buyer cannot withdraw the seller's listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.withdraw_listing((select id from public.listings where title = 'Drafting set'));

-- CHECK pending applicant cannot withdraw a listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select public.withdraw_listing(2);

-- CHECK anon cannot call withdraw_listing [error]
set role anon;
select public.withdraw_listing(2);

-- CHECK seller cannot withdraw own sold listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.withdraw_listing(1);

-- CHECK seller withdraws own listing; the pending request is cancelled, not deleted
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.withdraw_listing((select id from public.listings where title = 'Drafting set'));
reset role;
select (select status from public.listings where title = 'Drafting set') = 'withdrawn'
   and (select count(*) from public.purchase_requests r join public.listings l on l.id = r.listing_id
        where l.title = 'Drafting set' and r.status = 'cancelled' and r.closed_at is not null
          and r.closed_reason = 'The seller withdrew the listing.') = 1 as pass;

-- CHECK withdrawing twice is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.withdraw_listing((select id from public.listings where title = 'Drafting set'));

-- CHECK seller still sees the withdrawn listing; buyer sees it through the request
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
create temp table if not exists seen (who text, n bigint);
insert into seen select 'seller', count(*) from public.listings where title = 'Drafting set';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into seen select 'buyer', count(*) from public.listings where title = 'Drafting set';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
insert into seen select 'other', count(*) from public.listings where title = 'Drafting set';
select (select n from seen where who='seller') = 1 and (select n from seen where who='buyer') = 1
   and (select n from seen where who='other') = 0 as pass;

-- CHECK seller cannot edit the withdrawn listing (0 rows changed)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set price = 1 where title = 'Drafting set';
reset role;
select price = 400.00 as pass from public.listings where title = 'Drafting set';
