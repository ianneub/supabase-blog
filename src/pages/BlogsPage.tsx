import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/database.types'
import { blogPath } from '../lib/slug'
import Avatar from '../components/Avatar'

export default function BlogsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) setError(error.message)
      else setProfiles(data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="muted">Loading blogs…</p>
  if (error) return <p className="error">Could not load blogs: {error}</p>

  return (
    <>
      <h1 className="page-title">Blogs</h1>
      {profiles.length === 0 ? (
        <p className="muted">Nobody has signed up yet.</p>
      ) : (
        <ul className="blog-list">
          {profiles.map((p) => (
            <li key={p.id}>
              <Link to={blogPath(p.username)} className="blog-row">
                <Avatar url={p.avatar_url} name={p.display_name || p.username} size={40} />
                <span>
                  <strong>{p.display_name || p.username}</strong>
                  <span className="muted small block">@{p.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
