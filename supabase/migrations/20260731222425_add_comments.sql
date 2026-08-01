create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- Null author_id means an anonymous comment; author_name carries the display name.
  author_id uuid references public.profiles (id) on delete set null,
  author_name text check (author_name is null or char_length(btrim(author_name)) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint comments_identity_check check (author_id is not null or btrim(coalesce(author_name, '')) <> '')
);

create index comments_post_id_created_at_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

-- Readable wherever the post itself is readable.
create policy "Comments on published posts are viewable by everyone"
  on public.comments for select
  to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.published));

create policy "Post authors can view all comments on their posts"
  on public.comments for select
  to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );

-- Anyone may comment on a published post. A signed-in commenter must stamp their
-- own id (no impersonating another account); anon can only post unattributed,
-- since auth.uid() is null for them and the first branch requires a name.
create policy "Anyone can comment on published posts"
  on public.comments for insert
  to anon, authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.published)
    and (
      (author_id is null and btrim(coalesce(author_name, '')) <> '')
      or author_id = (select auth.uid())
    )
  );

create policy "Commenters can delete their own comments"
  on public.comments for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Post authors can moderate comments on their posts"
  on public.comments for delete
  to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );