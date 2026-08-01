// The `posts.slug` column is constrained to ^[a-z0-9]+(-[a-z0-9]+)*$ in Postgres,
// so anything this produces has to satisfy that or the insert is rejected.
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

// `profiles.username` is constrained to ^[a-z0-9](-?[a-z0-9]){0,38}$ — no leading,
// trailing, or doubled hyphens, max 39 characters.
export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 39)
    .replace(/-+$/g, '')
}

export const USERNAME_PATTERN = /^[a-z0-9](-?[a-z0-9]){0,38}$/

/** URLs carry the handle as `@name`; strip the sigil, or return null if absent. */
export function parseHandle(handle: string | undefined): string | null {
  if (!handle || !handle.startsWith('@')) return null
  const username = handle.slice(1).toLowerCase()
  return USERNAME_PATTERN.test(username) ? username : null
}

export function blogPath(username: string): string {
  return `/@${username}`
}

export function postPath(username: string, slug: string): string {
  return `/@${username}/${slug}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
