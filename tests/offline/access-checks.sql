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
insert into public.purchase_requests (listing_id, buyer_id, meetup_place, meetup_at, price_seen, status, accepted_at, completed_at)
 values (1, '00000000-0000-0000-0000-00000000000b', 'Library lobby', now() + interval '1 day', 650, 'completed', now(), now());
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
insert into public.purchase_requests (listing_id, buyer_id, meetup_place, meetup_at, price_seen)
 select id, '00000000-0000-0000-0000-00000000000b', 'Library lobby', now() + interval '2 days', 450.50
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

-- Phase 3: purchase requests. b = approved buyer, c = approved seller (owner of
-- the listings below), d = a second approved buyer (approved earlier), e = pending.
-- test_at(days, 'HH:MM') is a Manila-time helper for building meetup times.

-- CHECK setup request targets and a Manila time helper
reset role;
create function public.test_at(days int, hhmm time) returns timestamptz language sql as $$
  select ((date_trunc('day', now() at time zone 'Asia/Manila') + make_interval(days => days) + hhmm) at time zone 'Asia/Manila')
$$;
grant execute on function public.test_at(int, time) to authenticated;
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects, photo_path)
 select '00000000-0000-0000-0000-00000000000c', 1, 'BS Information Technology', t.title, 'Request test listing item', 300.00, 'good', 'None known',
        '00000000-0000-0000-0000-00000000000c/' || t.photo || '.jpg'
 from (values ('Request target one', 'aaaaaaaa-0000-0000-0000-000000000001'),
              ('Request target two', 'aaaaaaaa-0000-0000-0000-000000000002'),
              ('Request target three', 'aaaaaaaa-0000-0000-0000-000000000003')) as t(title, photo);
select count(*) = 3 as pass from public.listings where title like 'Request target%';

-- CHECK buyers can read the meetup places, anon and pending users cannot
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select (select count(*) from public.meetup_places) = 5
   and (select count(*) from public.meetup_places where name ~* 'official|safe') = 0 as pass;

-- CHECK pending applicant sees no meetup places
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select count(*) = 0 as pass from public.meetup_places;

-- CHECK buyer cannot insert a request directly [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.purchase_requests (listing_id, meetup_place, meetup_at, price_seen)
 select id, 'Canteen seating area', public.test_at(2, '10:00'), 1 from public.listings where title = 'Request target one';

-- CHECK buyer sends a request and the price seen is recorded
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select (r.buyer_id = '00000000-0000-0000-0000-00000000000b' and r.status = 'pending' and r.price_seen = 300.00
        and r.note = 'Can meet after class') as pass
from public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                  '  Can meet after class ', 'Canteen seating area', public.test_at(2, '10:00')) r;

-- CHECK a second request for the same listing by the same buyer is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                    null, 'Canteen seating area', public.test_at(3, '10:00'));

-- CHECK the one-request refusal explains the limit
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
do $$ begin
  perform public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                       null, 'Canteen seating area', public.test_at(3, '10:00'));
  raise exception 'no error';
exception when others then
  if sqlerrm not like 'You already sent a request%' then raise; end if;
end $$;
select true as pass;

-- CHECK the seller cannot request their own item [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK a pending applicant cannot send a request [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK anon cannot call send_purchase_request [error]
set role anon;
select public.send_purchase_request(1, null, 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK a sold listing cannot receive a request [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request(1, null, 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK a withdrawn listing cannot receive a request [error]
reset role;
select set_config('test.withdrawn_id', (select id::text from public.listings where title = 'Drafting set'), false);
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request(current_setting('test.withdrawn_id')::bigint,
                                    null, 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK a meetup time in the past is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(-1, '10:00'));

-- CHECK a meetup more than 30 days away is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(45, '10:00'));

-- CHECK a meetup at 22:00 Manila time is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(2, '22:00'));

-- CHECK a meetup place outside the list is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Behind the bike shed', public.test_at(2, '10:00'));

-- CHECK a note over 500 characters is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    repeat('x', 501), 'Canteen seating area', public.test_at(2, '10:00'));

-- CHECK a refused request leaves no row behind
reset role;
select count(*) = 0 as pass from public.purchase_requests r join public.listings l on l.id = r.listing_id
 where l.title = 'Request target two';

-- CHECK the other buyer cannot see the first buyer's request
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 0 as pass from public.purchase_requests;

-- CHECK the seller sees the request on their listing, with the price the buyer saw
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select count(*) = 1 and bool_and(price_seen = 300.00) as pass from public.purchase_requests r
 join public.listings l on l.id = r.listing_id where l.title = 'Request target one';

-- CHECK the price seen stays when the seller later edits the price
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
update public.listings set price = 250 where title = 'Request target one';
reset role;
select (select price from public.listings where title = 'Request target one') = 250
   and (select r.price_seen from public.purchase_requests r join public.listings l on l.id = r.listing_id
        where l.title = 'Request target one') = 300 as pass;

-- Accept and decline. a = admin (an approved member who is not involved),
-- b and d = buyers, c = seller, e = pending, requests on 'Request target one'.

-- CHECK setup a second buyer's request on the same listing
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select r.status = 'pending' and r.price_seen = 250.00 as pass
from public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                  null, 'Library entrance, in the open area', public.test_at(3, '14:30')) r;

-- CHECK a buyer cannot accept a request on someone else's listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.accept_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d' limit 1));

-- CHECK an unrelated approved member cannot accept [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.accept_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d' limit 1));

-- CHECK an unrelated approved member cannot decline [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.decline_purchase_request(1, null);

-- CHECK an unrelated approved member sees no requests
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select count(*) = 0 as pass from public.purchase_requests;

-- CHECK a pending applicant cannot accept [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000e',false);
select public.accept_purchase_request(1);

-- CHECK anon cannot accept or decline [error]
set role anon;
select public.accept_purchase_request(1);

-- CHECK anon cannot decline [error]
set role anon;
select public.decline_purchase_request(1, null);

-- CHECK a request id that does not exist gives the same refusal [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.accept_purchase_request(999999);

-- CHECK a refused accept changes nothing
reset role;
select (select count(*) from public.purchase_requests where status = 'pending' and listing_id =
         (select id from public.listings where title = 'Request target one')) = 2
   and (select status from public.listings where title = 'Request target one') = 'active' as pass;

-- CHECK the seller accepts one request: it is accepted, the listing is reserved, the other request is declined
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select r.status = 'accepted' and r.accepted_at is not null as pass
from public.accept_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one'))) r;

-- CHECK the other pending request was declined with an item-unavailable reason
reset role;
select (r.status = 'declined' and r.closed_at is not null and r.closed_reason like 'The item is no longer available%') as pass
from public.purchase_requests r where r.buyer_id = '00000000-0000-0000-0000-00000000000d'
   and r.listing_id = (select id from public.listings where title = 'Request target one');

-- CHECK the listing is reserved and has exactly one accepted request
reset role;
select (select status from public.listings where title = 'Request target one') = 'reserved'
   and (select count(*) from public.purchase_requests where status = 'accepted'
        and listing_id = (select id from public.listings where title = 'Request target one')) = 1 as pass;

-- CHECK a replayed accept is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.accept_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')));

-- CHECK accepting the declined request is refused and leaves everything as it was [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.accept_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d'
   and listing_id = (select id from public.listings where title = 'Request target one')));

-- CHECK the state after those refusals is unchanged
reset role;
select (select status from public.listings where title = 'Request target one') = 'reserved'
   and (select count(*) from public.purchase_requests where status = 'accepted'
        and listing_id = (select id from public.listings where title = 'Request target one')) = 1
   and (select count(*) from public.purchase_requests where status = 'declined'
        and listing_id = (select id from public.listings where title = 'Request target one')) = 1 as pass;

-- CHECK the database refuses a second accepted request on one listing even if a function is bypassed [error]
reset role;
update public.purchase_requests set status = 'accepted', accepted_at = now()
 where buyer_id = '00000000-0000-0000-0000-00000000000d'
   and listing_id = (select id from public.listings where title = 'Request target one');

-- CHECK a new request on the reserved listing is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                    null, 'Canteen seating area', public.test_at(3, '10:00'));

-- CHECK setup two requests on 'Request target two'
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from (select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
   'Is it still available?', 'Canteen seating area', public.test_at(2, '09:00'))) x;

-- CHECK second buyer on target two
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 1 as pass from (select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
   null, 'Canteen seating area', public.test_at(2, '11:00'))) x;

-- CHECK the seller declines one request with a reason; the other stays pending and the listing stays available
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select (r.status = 'declined' and r.closed_reason = 'Already promised to someone else' and r.closed_at is not null) as pass
from public.decline_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target two')), ' Already promised to someone else ') r;

-- CHECK the other request is still pending and the listing is still available
reset role;
select (select count(*) from public.purchase_requests where status = 'pending'
        and listing_id = (select id from public.listings where title = 'Request target two')) = 1
   and (select status from public.listings where title = 'Request target two') = 'active' as pass;

-- CHECK a replayed decline is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.decline_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target two')), null);

-- CHECK a declined buyer cannot send again, and the message explains the limit [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target two'),
                                    null, 'Canteen seating area', public.test_at(4, '10:00'));

-- CHECK the buyer sees the decline reason on their own request
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 and bool_and(closed_reason = 'Already promised to someone else') as pass
from public.purchase_requests r where r.status = 'declined' and r.listing_id = (select id from public.listings where title = 'Request target two');

-- CHECK a declined request cannot be accepted later [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.accept_purchase_request((select id from public.purchase_requests where status = 'declined'
   and listing_id = (select id from public.listings where title = 'Request target two')));

-- Cancel and complete. State now: target one is reserved (accepted: b; declined: d),
-- target two is active (declined: b; pending: d).

-- CHECK cancelling needs a reason [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')), '  ');

-- CHECK an unrelated member cannot cancel an accepted request [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')), 'Not my business');

-- CHECK the other buyer cannot cancel someone else's request [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')), 'Not my request');

-- CHECK an unrelated member cannot complete [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.complete_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')));

-- CHECK the buyer cannot complete the exchange [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.complete_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')));

-- CHECK a pending request cannot be completed [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.complete_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d'
   and listing_id = (select id from public.listings where title = 'Request target two')));

-- CHECK the seller cannot cancel a pending request, they decline it [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d'
   and listing_id = (select id from public.listings where title = 'Request target two')), 'Changed my mind');

-- CHECK a failed cancel leaves the listing and request unchanged
reset role;
select (select status from public.listings where title = 'Request target one') = 'reserved'
   and (select status from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
        and listing_id = (select id from public.listings where title = 'Request target one')) = 'accepted' as pass;

-- CHECK the seller cancels the accepted arrangement; the request is cancelled with the reason and the listing is available again
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select (r.status = 'cancelled' and r.closed_reason = 'Buyer did not answer messages' and r.closed_at is not null) as pass
from public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')), ' Buyer did not answer messages ') r;

-- CHECK the listing is available again and the declined request stayed declined
reset role;
select (select status from public.listings where title = 'Request target one') = 'active'
   and (select status from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d'
        and listing_id = (select id from public.listings where title = 'Request target one')) = 'declined' as pass;

-- CHECK a replayed cancel is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.cancel_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')), 'Again');

-- CHECK the cancelled buyer cannot send a second request for the reopened listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.send_purchase_request((select id from public.listings where title = 'Request target one'),
                                    null, 'Canteen seating area', public.test_at(3, '10:00'));

-- CHECK a cancelled request cannot be completed [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.complete_purchase_request((select id from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
   and listing_id = (select id from public.listings where title = 'Request target one')));

-- CHECK the reopened listing can take another request, and the seller can accept it
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select count(*) = 1 as pass from (select public.send_purchase_request((select id from public.listings where title = 'Request target one'),
   'Second chance', 'Canteen seating area', public.test_at(5, '15:00'))) x;

-- CHECK the seller accepts it and the listing is reserved again
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select r.status = 'accepted' as pass from public.accept_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000a' and listing_id = (select id from public.listings where title = 'Request target one'))) r;

-- CHECK the buyer cancels an accepted request, and the listing reopens
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select r.status = 'cancelled' as pass from public.cancel_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000a' and listing_id = (select id from public.listings where title = 'Request target one')), 'Schedule clash') r;

-- CHECK the listing reopened after the buyer cancelled
reset role;
select (select status from public.listings where title = 'Request target one') = 'active' as pass;

-- CHECK a buyer cancels their own pending request with a reason
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select (r.status = 'cancelled' and r.closed_reason = 'Found one elsewhere') as pass from public.cancel_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000d' and listing_id = (select id from public.listings where title = 'Request target two')), 'Found one elsewhere') r;

-- CHECK a cancelled pending request leaves the listing available
reset role;
select (select status from public.listings where title = 'Request target two') = 'active' as pass;

-- CHECK setup a request on target three and accept it
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) = 1 as pass from (select public.send_purchase_request((select id from public.listings where title = 'Request target three'),
   null, 'Engineering building lobby', public.test_at(2, '16:00'))) x;

-- CHECK a second buyer on target three
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) = 1 as pass from (select public.send_purchase_request((select id from public.listings where title = 'Request target three'),
   null, 'Engineering building lobby', public.test_at(2, '17:00'))) x;

-- CHECK accept the first buyer on target three
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select r.status = 'accepted' as pass from public.accept_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000b' and listing_id = (select id from public.listings where title = 'Request target three'))) r;

-- CHECK the seller completes the exchange: that request is completed and the item is sold
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select (r.status = 'completed' and r.completed_at is not null) as pass from public.complete_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000b' and listing_id = (select id from public.listings where title = 'Request target three'))) r;

-- CHECK only the accepted request is completed, the other stays declined, and the listing is sold
reset role;
select (select status from public.listings where title = 'Request target three') = 'sold'
   and (select status from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000b'
        and listing_id = (select id from public.listings where title = 'Request target three')) = 'completed'
   and (select status from public.purchase_requests where buyer_id = '00000000-0000-0000-0000-00000000000d'
        and listing_id = (select id from public.listings where title = 'Request target three')) = 'declined' as pass;

-- CHECK a replayed complete is refused [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select public.complete_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000b' and listing_id = (select id from public.listings where title = 'Request target three')));

-- CHECK a completed request cannot be cancelled by the buyer [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.cancel_purchase_request((select id from public.purchase_requests
   where buyer_id = '00000000-0000-0000-0000-00000000000b' and listing_id = (select id from public.listings where title = 'Request target three')), 'Too late');

-- CHECK a sold listing's history stays with the seller and the buyer
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select (select count(*) from public.purchase_requests r join public.listings l on l.id = r.listing_id where l.title = 'Request target three') = 2 as pass;

-- CHECK the request functions are not callable by anon
select bool_and(not has_function_privilege('anon', p.oid, 'execute')) as pass
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('send_purchase_request','accept_purchase_request','decline_purchase_request','cancel_purchase_request','complete_purchase_request');
