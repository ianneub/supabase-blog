create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text,
  content text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_published_created_at_idx on public.posts (published, created_at desc);
create index posts_author_id_idx on public.posts (author_id);

create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

-- Anyone (including logged-out visitors) can read published posts.
create policy "Published posts are viewable by everyone"
  on public.posts for select
  to anon, authenticated
  using (published = true);

-- Authors can always see their own drafts.
create policy "Authors can view their own posts"
  on public.posts for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Authors can create their own posts"
  on public.posts for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Authors can update their own posts"
  on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors can delete their own posts"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));