-- Supabase grants anon/authenticated broad table privileges by default when a
-- project is created, so this schema worked without ever saying so out loud.
-- A database rebuilt from these migrations alone gets no such grants and fails
-- with "permission denied" before RLS is consulted. State them explicitly so
-- the migrations are self-contained.
--
-- These are table-level privileges: the floor. RLS policies then decide which
-- rows are reachable. Granting only what the policies can actually use keeps
-- the two aligned instead of relying on RLS to claw back a blanket GRANT ALL.

grant usage on schema public to anon, authenticated;

-- Profiles are a public directory; only the owner may edit, enforced by RLS.
grant select                 on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

-- Published posts are world-readable; writes are the author's, enforced by RLS.
grant select                         on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;

-- Anonymous visitors may read and add comments, but never remove them.
grant select, insert         on public.comments to anon;
grant select, insert, delete on public.comments to authenticated;

-- TRUNCATE is not subject to row-level security, so no API role should hold it.
-- PostgREST never issues TRUNCATE and neither role can log in directly, which
-- makes this defence in depth rather than a fix for a reachable hole.
revoke truncate on public.profiles, public.posts, public.comments from anon, authenticated;