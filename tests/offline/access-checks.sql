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
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects)
 values ('00000000-0000-0000-0000-00000000000c', 1, 'BS Information Technology', 'Casio fx-991ES', 'Scientific calculator, works well', 650.00, 'good', 'None known');
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

-- CHECK buyer cannot insert listing [error]
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.listings (category_id, program, title, description, price, condition, known_defects) values (1,'BS IT','Thing','A thing for sale here',10,'good','None');

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
insert into public.listings (seller_id, category_id, program, title, description, price, condition, known_defects)
 values ('00000000-0000-0000-0000-00000000000c', 1, 'BS IT', 'Bad price', 'This has a negative price', -5, 'good', 'None known');

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

-- CHECK existing helper functions still work for signed-in users
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.current_user_is_approved() as pass;
