-- Each signed-in user gets a profile, which is their blog.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9](-?[a-z0-9]){0,38}$'),
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Derive a unique, constraint-safe username from the GitHub metadata Supabase
-- stores on the auth user, falling back to the email local-part.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate text;
  n int := 0;
begin
  base_username := lower(coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  ));
  base_username := regexp_replace(base_username, '[^a-z0-9]+', '-', 'g');
  base_username := left(base_username, 30);
  base_username := trim(both '-' from base_username);

  if base_username is null or base_username = '' then
    base_username := 'writer';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base_username || '-' || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    nullif(coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ), ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that already existed.
insert into public.profiles (id, username, display_name, avatar_url)
select
  u.id,
  'writer-' || left(replace(u.id::text, '-', ''), 8),
  nullif(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ''),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- Slugs are now unique per blog, not globally, so two people can both write
-- a post called "hello-world".
alter table public.posts drop constraint posts_slug_key;
alter table public.posts add constraint posts_author_slug_key unique (author_id, slug);

-- Second FK so PostgREST can embed the author profile on a post query.
alter table public.posts
  add constraint posts_author_id_profiles_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;