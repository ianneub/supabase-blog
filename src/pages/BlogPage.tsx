import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import type { Post, Profile } from '../lib/database.types'
import { formatDate, parseHandle, postPath } from '../lib/slug'
import { useAuth } from '../context/auth-context'
import Avatar from '../components/Avatar'
import NotFound from '../components/NotFound'

export default function BlogPage() {
  const { handle } = useParams<{ handle: string }>()
  const username = parseHandle(handle)
  const { user } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .maybeSingle()

      if (cancelled) return
      if (profError) {
        setError(profError.message)
        setLoading(false)
        return
      }
      if (!prof) {
        setLoading(false)
        return
      }
      setProfile(prof)

      // Drafts are filtered out by RLS for everyone but the author, so the
      // author sees their own unpublished posts listed here too.
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', prof.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) setError(error.message)
      else setPosts(data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username])

  if (loading) return <p className="muted">Loading…</p>
  if (error) return <p className="error">Could not load this blog: {error}</p>
  if (!username || !profile) {
    return <NotFound title="Blog not found" message="No one here goes by that name." />
  }

  const name = profile.display_name || profile.username
  const isMine = user?.id === profile.id

  return (
    <>
      <div className="profile-header">
        <Avatar url={profile.avatar_url} name={name} size={64} />
        <div>
          <h1>{name}</h1>
          <p className="muted small">@{profile.username}</p>
          {profile.bio && <p className="bio">{profile.bio}</p>}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="muted">
          {isMine ? 'You have not written anything yet.' : 'No posts here yet.'}
        </p>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-card">
              <div className="byline">
                <time dateTime={post.created_at} className="muted small">
                  {formatDate(post.created_at)}
                </time>
                {!post.published && <span className="pill">Draft</span>}
              </div>
              <h2>
                <Link to={postPath(profile.username, post.slug)}>{post.title}</Link>
              </h2>
              {post.excerpt && <p className="excerpt">{post.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
