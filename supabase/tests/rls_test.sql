-- Security assertions, run against a throwaway database built from
-- supabase/migrations/. Any failure raises an exception, so psql with
-- ON_ERROR_STOP=1 exits non-zero and fails CI.
--
--   supabase db reset
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
--
-- The whole run is one transaction and ends in a rollback: it leaves no data
-- behind and is safe to point at any non-production database.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Structural: RLS must be on, everywhere, with policies attached.
-- ---------------------------------------------------------------------------

-- A table with RLS off is readable and writable by anyone holding the
-- publishable key, which is public by design. This is the single most
-- important assertion in the file.
do $$
declare offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if offenders is not null then
    raise exception 'RLS is disabled on public table(s): %', offenders;
  end if;
end $$;

-- RLS on with zero policies denies everything, which is safe but almost
-- certainly a mistake worth surfacing.
do $$
declare offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  if offenders is not null then
    raise exception 'RLS enabled but no policies on: %', offenders;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Inventory: the exact set of policies reachable by anonymous visitors.
--
-- This is a tripwire, not a rule. If someone adds, removes, or re-scopes a
-- policy that `anon` can reach, this fails until the change is made
-- deliberately here. Update it in the same commit that changes a policy.
-- ---------------------------------------------------------------------------
do $$
declare
  actual text;
  expected text := $exp$comments|INSERT|Anyone can comment on published posts
comments|SELECT|Comments on published posts are viewable by everyone
posts|SELECT|Published posts are viewable by everyone
profiles|SELECT|Profiles are viewable by everyone$exp$;
begin
  select string_agg(tablename || '|' || cmd || '|' || policyname, E'\n' order by tablename, cmd, policyname)
  into actual
  from pg_policies
  where schemaname = 'public' and 'anon' = any (roles);

  if coalesce(actual, '') is distinct from expected then
    raise exception E'anon-reachable policies changed.\n--- expected ---\n%\n--- actual ---\n%', expected, coalesce(actual, '(none)');
  end if;
end $$;

-- Anonymous visitors may write to exactly one place: comments. If a second
-- anon-writable policy appears, that is a significant widening of the attack
-- surface and should be an explicit decision.
do $$
declare n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and 'anon' = any (roles)
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');

  if n <> 1 then
    raise exception 'expected exactly 1 anon-writable policy (comments INSERT), found %', n;
  end if;
end $$;

-- Trigger functions must not be callable over the REST API.
do $$
declare offenders text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('handle_new_user', 'set_updated_at')
    and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'));

  if offenders is not null then
    raise exception 'trigger function(s) executable via REST: %', offenders;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures for the behavioural tests below.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@example.test',
   '{"user_name":"Alice","full_name":"Alice Example"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@example.test',
   '{"user_name":"Bob"}'::jsonb, now(), now());

-- The signup trigger should have produced a profile per user, with the
-- username derived from GitHub metadata and lowercased.
do $$
declare uname text;
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'signup trigger did not create a profile per user (got %)',
      (select count(*) from public.profiles);
  end if;

  select username into uname from public.profiles
  where id = '11111111-1111-4111-8111-111111111111';

  if uname <> 'alice' then
    raise exception 'expected username derived from GitHub user_name to be "alice", got "%"', uname;
  end if;
end $$;

insert into public.posts (id, author_id, title, slug, content, published) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
   'Alice published', 'alice-published', 'public body', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111',
   'Alice draft', 'alice-draft', 'secret body', false);

-- Slugs are unique per author, not globally: Bob may reuse Alice's slug.
insert into public.posts (author_id, title, slug, content, published)
values ('22222222-2222-4222-8222-222222222222', 'Bob published', 'alice-published', 'bob body', true);

-- ---------------------------------------------------------------------------
-- Behavioural: as an anonymous visitor.
--
-- `set local role anon` gives this session exactly the privileges of a
-- logged-out visitor, so these succeed or fail as a real attacker's would.
-- ---------------------------------------------------------------------------

set local role anon;

do $$
declare n int;
begin
  -- Drafts must be invisible. Two published posts exist, one draft.
  select count(*) into n from public.posts;
  if n <> 2 then
    raise exception 'anon should see exactly the 2 published posts, saw %', n;
  end if;

  select count(*) into n from public.posts where published = false;
  if n <> 0 then
    raise exception 'anon can see % draft(s)', n;
  end if;

  -- Draft body must not leak through a targeted lookup either.
  select count(*) into n from public.posts where slug = 'alice-draft';
  if n <> 0 then
    raise exception 'anon can read a draft by slug';
  end if;
end $$;

-- Anonymous commenting on a published post is allowed, and is the one
-- unauthenticated write this application accepts.
insert into public.comments (post_id, author_name, body)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Passerby', 'nice post');

do $$
begin
  -- ...but not on a draft.
  begin
    insert into public.comments (post_id, author_name, body)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Snoop', 'commenting on your draft');
    raise exception 'ASSERTION FAILED: anon commented on a draft';
  exception when insufficient_privilege then null;
  end;

  -- ...and never attributed to a real account.
  begin
    insert into public.comments (post_id, author_id, author_name, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '11111111-1111-4111-8111-111111111111', 'Impostor', 'I am Alice');
    raise exception 'ASSERTION FAILED: anon forged author_id on a comment';
  exception when insufficient_privilege then null;
  end;

  -- No posting.
  begin
    insert into public.posts (author_id, title, slug, content, published)
    values ('11111111-1111-4111-8111-111111111111', 'spam', 'spam', 'x', true);
    raise exception 'ASSERTION FAILED: anon created a post';
  exception when insufficient_privilege then null;
  end;

  -- The remaining writes must not happen. Two distinct defences can stop them:
  -- the table grant (raises insufficient_privilege) or an RLS policy that
  -- matches no rows (affects 0 rows). Either is a pass; anything that actually
  -- modifies a row is a failure.

  -- No editing someone else's post.
  begin
    update public.posts set title = 'defaced' where slug = 'alice-published';
    if found then
      raise exception 'ASSERTION FAILED: anon updated a post';
    end if;
  exception when insufficient_privilege then null;
  end;

  -- No deleting comments.
  begin
    delete from public.comments;
    if found then
      raise exception 'ASSERTION FAILED: anon deleted comments';
    end if;
  exception when insufficient_privilege then null;
  end;

  -- No touching profiles.
  begin
    update public.profiles set username = 'hijacked' where username = 'alice';
    if found then
      raise exception 'ASSERTION FAILED: anon updated a profile';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Behavioural: as a signed-in user. auth.uid() reads the sub claim, so
-- setting request.jwt.claims is what makes this session "Bob".
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
declare n int;
begin
  -- Bob sees both published posts plus his own, but never Alice's draft.
  select count(*) into n from public.posts where slug = 'alice-draft';
  if n <> 0 then
    raise exception 'ASSERTION FAILED: Bob can read Alice''s draft';
  end if;

  -- Bob cannot write as Alice.
  begin
    insert into public.posts (author_id, title, slug, content, published)
    values ('11111111-1111-4111-8111-111111111111', 'forged', 'forged-post', 'x', true);
    raise exception 'ASSERTION FAILED: Bob created a post authored by Alice';
  exception when insufficient_privilege then null;
  end;

  -- Bob cannot edit or delete Alice's post.
  update public.posts set title = 'defaced' where slug = 'alice-published'
    and author_id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'ASSERTION FAILED: Bob updated Alice''s post';
  end if;

  delete from public.posts where author_id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'ASSERTION FAILED: Bob deleted Alice''s post';
  end if;

  -- Bob cannot rename Alice's blog.
  update public.profiles set username = 'stolen'
  where id = '11111111-1111-4111-8111-111111111111';
  if found then
    raise exception 'ASSERTION FAILED: Bob updated Alice''s profile';
  end if;

  -- Bob can manage his own post.
  update public.posts set title = 'Bob renamed'
  where author_id = '22222222-2222-4222-8222-222222222222';
  if not found then
    raise exception 'ASSERTION FAILED: Bob could not update his own post';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Behavioural: a post author moderating comments on their own post.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  -- Alice sees the anonymous comment left on her post and can remove it.
  delete from public.comments
  where post_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if not found then
    raise exception 'ASSERTION FAILED: post author could not moderate a comment on their own post';
  end if;
end $$;

reset role;

rollback;

\echo '── all security assertions passed ──'
