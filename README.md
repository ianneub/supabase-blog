# Supabase Blog

A multi-author blog. Anyone can sign in with GitHub to get their own blog at
`/@their-username`, publish posts, and moderate comments. Readers can comment
either signed in with GitHub or anonymously with just a display name.

React + TypeScript + Vite on the front end, Supabase (Postgres, Auth, RLS) as the
entire back end — there is no server of your own.

## Setup

### 1. Install

```bash
npm install
```

`.env.local` is already pointed at the Supabase project `iephdkkadnuncjmfvnrq`.
For a different project, copy `.env.example` and fill in the two values.

### 2. Enable GitHub sign-in (required — this cannot be done from code)

Sign-in fails with `Unsupported provider` until this is done.

**a. Create a GitHub OAuth app** — <https://github.com/settings/developers> →
_OAuth Apps_ → _New OAuth App_:

| Field | Value |
| --- | --- |
| Application name | anything, e.g. `Supabase Blog (dev)` |
| Homepage URL | `http://localhost:5173` |
| Authorization callback URL | `https://iephdkkadnuncjmfvnrq.supabase.co/auth/v1/callback` |

The callback URL must be the **Supabase** one above, not localhost. Generate a
client secret and keep both values handy.

**b. Paste them into Supabase** — Dashboard → _Authentication_ → _Sign In / Providers_
→ **GitHub**: toggle on, paste the Client ID and Client Secret, save.

**c. Set the redirect URLs** — Dashboard → _Authentication_ → _URL Configuration_:

- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: add `http://localhost:5173/**`

### 3. Run

```bash
npm run dev
```

The first person to sign in gets a username derived from their GitHub handle and
can rename it under _Settings_.

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

Verified against the live database by querying as the `anon` role:

- Published posts are readable by everyone; **drafts are visible only to their author**.
- Anonymous visitors can comment on published posts, but **not on drafts**.
- An anonymous visitor **cannot set `author_id`**, so guest comments cannot
  impersonate an account.
- Anonymous visitors cannot create posts or delete comments.
- Deleting a user cascades to their profile, posts, and comments.

Comment moderation: a post's author can delete any comment on their own post, and
signed-in commenters can delete their own. Anonymous comments carry no identity, so
only the post author can remove them.

## Notes and trade-offs

- **Anonymous comments are unauthenticated writes.** The policy is scoped as tightly
  as it can be, but there is no rate limiting or spam filter. Before putting this on
  the public internet, add a captcha (Supabase supports Turnstile/hCaptcha) or switch
  guests to Supabase anonymous sign-ins so you get per-user rate limits.
- **Post bodies are plain text**, split into paragraphs on blank lines and rendered
  through React, so they are escaped — no HTML injection. Adding a Markdown renderer
  would mean adding sanitization.
- **The publishable key in `.env.local` is meant to be public.** It grants exactly
  what the RLS policies above allow. Never put the service-role key in this app.
- **Client-side routing**: a static host needs an SPA fallback rewrite to
  `index.html`, or `/@someone/post` will 404 on refresh.
- Deploying anywhere other than localhost means adding that origin to the GitHub
  OAuth app and to Supabase's redirect URLs.

## Regenerating types

After any schema change:

```bash
npx supabase gen types typescript --project-id iephdkkadnuncjmfvnrq > src/lib/database.types.ts
```

The hand-written aliases at the bottom of that file (`Post`, `Profile`,
`PostWithAuthor`, `CommentWithAuthor`, …) need to be re-appended afterwards.

## License

MIT — see [LICENSE](LICENSE).
