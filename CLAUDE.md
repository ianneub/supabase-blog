# Working in this repo

Read [README.md](README.md) first — it covers the architecture, the data model, and
how to audit the security rules. This file only lists the things that are easy to
get wrong.

There is no server. The browser talks straight to Supabase with a publishable key,
so **every access rule is an RLS policy, not application code**. A check written in
a React component is a UX affordance, not a security control. Never add the
service-role key to this app.

## Import from `react-router`, not `react-router-dom`

The packages consolidated in v8; `react-router-dom` is a dead package stuck on 7.x.
Every symbol this app uses (`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`,
`Outlet`, `Navigate`, `useParams`, `useNavigate`, `useLocation`) comes from
`react-router`.

## Auth settings live in two places that must agree

`supabase/config.toml`'s `[auth]` block configures the **local** stack only; the
hosted project is configured in the dashboard. When they drift, sign-up behaves one
way in `npm run dev` and another in production. `enable_confirmations = true` is the
pair that matters most — with it on, `signUp` returns `session: null` and the user
is not logged in until they click the emailed link.

Locally no mail is delivered. Confirmation and password-reset messages land in the
inbox at <http://127.0.0.1:54324>.

A new email account gets its `/@handle` from the `handle_new_user()` trigger, which
reads `raw_user_meta_data->>'user_name'` — so `LoginPage` passes the requested name
through `signUp`'s `options.data`, not through a later `profiles` update. The trigger
sanitises it and resolves collisions by appending `-1`, so a requested name is a
preference, not a guarantee.

## Schema changes go through migrations, never the dashboard

Add a file to `supabase/migrations/`. The **drift** CI job diffs production against
these files, and the **security** job rebuilds a database from them alone — a change
made in the Supabase dashboard fails both.

Grants are part of the schema. `20260801010356_explicit_table_grants.sql` exists
because the original tables relied on Supabase's project-creation defaults, so a
rebuilt database was missing the `anon`/`authenticated` grants and behaved
differently from production. New tables need explicit grants in the same migration.

## Changing an RLS policy means changing the test file

`supabase/tests/rls_test.sql` asserts an **exact inventory** of the policies `anon`
can reach. Adding, removing, or re-scoping one fails CI until the inventory is
updated — that tripwire is the point, so update it deliberately rather than
loosening the assertion. The suite is verified to fail, not just to pass.

Run it locally:

```bash
supabase start
psql "$(supabase status -o json | jq -r .DB_URL)" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
```

## `database.types.ts` has hand-written aliases at the bottom

Everything below the `Database` type is hand-written — the `Post`/`Profile`/`Comment`
row, insert, and update aliases plus `PostWithAuthor` and `CommentWithAuthor` — and
**regeneration silently deletes all of it**. Re-append after running
`supabase gen types`.

The `*WithAuthor` types describe the embedded-FK shape PostgREST returns for
`select('*, profiles!...(...)')`, which the generated types do not model.

## Two files that look redundant but are not

- **`src/context/auth-context.ts` vs `AuthContext.tsx`** — the hook and context live
  apart from the provider component so each file exports only components or only
  non-components. Merging them breaks React Fast Refresh; `react/only-export-components`
  is set to `warn`, so lint flags it without failing the build.
- **`public/_redirects`** — `/* /index.html 200` is what makes deep links survive a
  hard refresh. Without it `/@someone/a-post` 404s when opened from a link.

## Routes

Static segments outrank dynamic ones, so `/blogs` and `/login` win over the
`:handle` catch-all in `App.tsx`. Adding a new top-level route needs no reordering,
but it does claim that word from the `@username` namespace.

## Deploying

```bash
npm run deploy   # build + wrangler pages deploy, production
```

The `env -u CLOUDFLARE_API_TOKEN` prefix is deliberate — it drops an ambient
work-scoped token from the shell so wrangler uses the personal OAuth credentials
from `wrangler login`. Don't "clean it up."

The build inlines `.env.local`, so a deploy currently depends on that file existing
locally.
