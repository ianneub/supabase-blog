# Supabase Blog

A multi-author blog. Anyone can sign in with GitHub to get their own blog at
`/@their-username`, publish posts, and moderate comments. Readers can comment
either signed in with GitHub or anonymously with just a display name.

**Live at [blog.ianneubert.com](https://blog.ianneubert.com)**

React + TypeScript + Vite on the front end, Supabase (Postgres, Auth, RLS) as the
entire back end, deployed as a static bundle on Cloudflare Pages. There is no
server of our own — the browser talks directly to Supabase, so every access rule
lives in a row-level security policy rather than in application code.

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

Both values come from your Supabase project: **Project Settings → Data API** for
the URL, and **API Keys** for the publishable key. The publishable key is meant to
be shipped to the browser — it grants exactly what the RLS policies allow. Never
put the service-role key in this app.

## Connecting it to your own Supabase project

The full schema is in [`supabase/migrations/`](supabase/migrations), applied in
filename order. Point the Supabase CLI at a new project and `supabase db push`
reproduces every table, index, trigger, and policy. Then wire up GitHub:

**1. Create a GitHub OAuth app** — <https://github.com/settings/developers> →
_OAuth Apps_ → _New OAuth App_:

| Field | Value |
| --- | --- |
| Homepage URL | your site's URL |
| Authorization callback URL | `https://<project-ref>.supabase.co/auth/v1/callback` |

The callback URL points at **Supabase**, not at your site, and it stays the same
no matter where the app is hosted. This trips people up constantly.

**2. Paste the credentials into Supabase** — Dashboard → _Authentication_ →
_Sign In / Providers_ → **GitHub**: toggle on, paste the Client ID and Client
Secret, save. Until this is done, sign-in fails with `Unsupported provider`.

**3. Set the URLs** — Dashboard → _Authentication_ → _URL Configuration_:

- **Site URL**: your production origin
- **Redirect URLs**: every origin the app runs on, each with a `/**` suffix —
  for this deployment that is `https://blog.ianneubert.com/**`,
  `https://supabase-blog.pages.dev/**`, and `http://localhost:5173/**`

The wildcards matter. OAuth returns to `/dashboard`, so a bare origin will not
match. When a redirect is not on the allowlist Supabase does not error — it
silently falls back to **Site URL**, whose default is `http://localhost:3000`.
That fallback is the cause of nearly every "why did it send me to localhost"
report.

## Deploying

```bash
npm run deploy           # build + publish to production
npm run deploy:preview   # build + publish to a preview URL
```

That runs `wrangler pages deploy` against the Cloudflare Pages project
`supabase-blog`. Two details worth knowing if you fork this:

- The scripts prefix `env -u CLOUDFLARE_API_TOKEN` to drop any ambient token from
  the shell, so wrangler uses the OAuth credentials from `wrangler login`, and
  pin `CLOUDFLARE_ACCOUNT_ID` so it never prompts between accounts. Change or
  remove both for your own setup.
- `public/_redirects` and `public/_headers` are copied into `dist/` by Vite and
  interpreted by Pages. The first is what makes client-side routes survive a hard
  refresh; the second sets caching.

Deploying anywhere new means adding that origin to Supabase's Redirect URLs and
updating the GitHub OAuth app's Homepage URL — but never its callback URL.

### Why `_redirects` is not optional

`/*  /index.html  200` serves the SPA shell for any path that is not a real file,
with a **200 rather than a redirect**, so React Router can take over. Without it,
`/@someone/a-post` works when navigated to in-app but 404s on refresh or when
opened from a link. Any static host needs an equivalent — an `.htaccess` rewrite
on Apache, a custom error response on S3/CloudFront.

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/` | everyone | Latest published posts across all blogs |
| `/blogs` | everyone | Directory of everyone's blogs |
| `/@username` | everyone | One person's blog (the author also sees their drafts) |
| `/@username/post-slug` | everyone | A post, with comments |
| `/login` | signed out | GitHub sign-in |
| `/dashboard` | signed in | Your posts: publish, unpublish, delete |
| `/new`, `/edit/:id` | signed in | Post editor |
| `/settings` | signed in | Username, display name, bio |

## Data model

Three tables in `public`, all with row-level security enabled.

**`profiles`** — one row per user, created automatically by an `on_auth_user_created`
trigger that derives a unique username from the GitHub metadata Supabase stores
(`user_name`, `full_name`, `avatar_url`), falling back to the email local-part and
appending `-1`, `-2`… on collision.

**`posts`** — `author_id` → `profiles`, with `unique (author_id, slug)` so two people
can each have a `hello-world`.

**`comments`** — `author_id` is nullable: null means an anonymous comment, and
`author_name` carries the display name. A check constraint requires one or the other.

### What the policies actually enforce

Verified against the live database by querying as the `anon` role, not through the
app:

- Published posts are readable by everyone; **drafts are visible only to their author**.
- Anonymous visitors can comment on published posts, but **not on drafts**.
- An anonymous visitor **cannot set `author_id`**, so guest comments cannot
  impersonate an account.
- Anonymous visitors cannot create posts or delete comments.
- Deleting a user cascades to their profile, posts, and comments.

Comment moderation: a post's author can delete any comment on their own post, and
signed-in commenters can delete their own. Anonymous comments carry no identity, so
only the post author can remove them.

## Auditing the security rules

The migration files are the intent; the database is the truth. They can drift —
anyone with dashboard access can add a policy without a migration. Audit the
database directly, not the files.

**1. Confirm RLS is on and every table has policies.** A table with RLS enabled and
zero policies denies everything; a table with RLS *off* is wide open to anyone
holding the publishable key, which is public by design.

```sql
select c.relname as table, c.relrowsecurity as rls_enabled, count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by 1, 2 order by 1;
```

Expected: `comments` 5, `posts` 5, `profiles` 3, all with `rls_enabled = true`.

**2. Read every policy expression.** Pay attention to the `roles` column — `anon`
means logged-out visitors on the public internet.

```sql
select tablename, policyname, cmd, roles::text, qual as using_expr, with_check
from pg_policies where schemaname = 'public'
order by tablename, cmd;
```

**3. Run Supabase's linter**, which catches missing RLS and functions exposed over
the REST API: Dashboard → _Advisors_ → _Security_.

**4. Test as the roles themselves.** This is the only step that proves anything;
the ones above only tell you what the rules say. Inside a transaction, `set local
role anon` makes the session an anonymous visitor, so the checks below either
succeed or fail exactly as a real attacker's would:

```sql
begin;
set local role anon;
-- should return only published posts
select count(*) from public.posts;
-- should raise: new row violates row-level security policy
insert into public.posts (author_id, title, slug, content, published)
values ('<some-uuid>', 'x', 'x', 'x', true);
rollback;
```

The claims under [What the policies actually enforce](#what-the-policies-actually-enforce)
were each verified this way — including that an anonymous visitor cannot set
`author_id` on a comment, and cannot comment on an unpublished draft.

## Notes and trade-offs

- **Anonymous comments are unauthenticated writes.** The policy is scoped as
  tightly as it can be, but there is no rate limiting or spam filter, and because
  the browser writes straight to Supabase, neither Cloudflare's WAF nor a
  client-side captcha can gate them — those requests never pass through the site's
  own domain. Closing this properly means routing comment writes through a Pages
  Function that verifies a Turnstile token, then dropping the anonymous INSERT
  policy. The cheap alternative is to require sign-in to comment.
- **Post bodies are plain text**, split into paragraphs on blank lines and rendered
  through React, so they are escaped — no HTML injection. Adding a Markdown
  renderer would mean adding sanitization.
- **Types are generated from the live schema.** `src/lib/database.types.ts` is
  mostly generated; the aliases at the bottom (`Post`, `Profile`, `PostWithAuthor`,
  `CommentWithAuthor`) are hand-written and must be re-appended after regenerating:

  ```bash
  npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
  ```

## License

MIT — see [LICENSE](LICENSE).
