-- New functions must not be callable by visitors or signed-in users by default.
--
-- Postgres gives EXECUTE on every new function to PUBLIC, and Supabase also
-- grants it to anon and authenticated for functions created in the public
-- schema. The earlier revoke only covered functions that already existed, so
-- later RPCs (accept, cancel, complete) would have been callable by anyone.
-- From now on each migration grants EXECUTE to authenticated explicitly, and
-- each function still checks auth.uid() and the caller's approval itself.
--
-- These apply to functions created by the postgres role, which runs migrations.
alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
