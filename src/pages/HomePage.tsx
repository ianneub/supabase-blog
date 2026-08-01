import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor } from '../lib/database.types'
import { blogPath, formatDate, postPath } from '../lib/slug'
import Avatar from '../components/Avatar'

export default function HomePage() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // RLS keeps this to published posts only, even for signed-out visitors.
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles!posts_author_id_profiles_fkey(username, display_name, avatar_url)')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (error) setError(error.message)
      else setPosts((data ?? []) as PostWithAuthor[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="muted">Loading posts…</p>
  if (error) return <p className="error">Could not load posts: {error}</p>

  if (posts.length === 0) {
    return (
      <div className="empty">
        <h1>No posts yet</h1>
        <p className="muted">
          Sign in with GitHub, and whatever you publish shows up here and on your own blog.
        </p>
        <Link to="/login" className="btn btn-primary">
          Start your blog
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="page-title">Latest across all blogs</h1>
      <ul className="post-list">
        {posts.map((post) => {
          const author = post.profiles
          const name = author?.display_name || author?.username || 'Unknown'
          return (
            <li key={post.id} className="post-card">
              <div className="byline">
                {author && (
                  <Link to={blogPath(author.username)} className="byline-link">
                    <Avatar url={author.avatar_url} name={name} size={22} />
                    <span>{name}</span>
                  </Link>
                )}
                <time dateTime={post.created_at} className="muted small">
                  {formatDate(post.created_at)}
                </time>
              </div>
              <h2>
                {author ? (
                  <Link to={postPath(author.username, post.slug)}>{post.title}</Link>
                ) : (
                  post.title
                )}
              </h2>
              {post.excerpt && <p className="excerpt">{post.excerpt}</p>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
