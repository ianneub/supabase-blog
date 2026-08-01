import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import type { Post, Profile } from '../lib/database.types'
import { blogPath, formatDate, parseHandle } from '../lib/slug'
import { useAuth } from '../context/auth-context'
import Avatar from '../components/Avatar'
import Comments from '../components/Comments'
import NotFound from '../components/NotFound'

export default function PostPage() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>()
  const username = parseHandle(handle)
  const { user } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [author, setAuthor] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username || !slug) {
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
      setAuthor(prof)

      // Slugs are unique per author, so both halves of the URL are needed.
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', prof.id)
        .eq('slug', slug!)
        .maybeSingle()

      if (cancelled) return
      if (error) setError(error.message)
      else setPost(data)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username, slug])

  if (loading) return <p className="muted">Loading…</p>
  if (error) return <p className="error">Could not load post: {error}</p>

  // Someone else's draft is invisible under RLS, so it reads as "not found".
  if (!post || !author) {
    return (
      <NotFound
        title="Post not found"
        message="It may have been deleted, or it is still a draft."
      />
    )
  }

  const name = author.display_name || author.username

  return (
    <article className="post">
      {!post.published && <p className="badge">Draft — only you can see this</p>}
      <h1>{post.title}</h1>

      <div className="byline">
        <Link to={blogPath(author.username)} className="byline-link">
          <Avatar url={author.avatar_url} name={name} size={24} />
          <span>{name}</span>
        </Link>
        <time dateTime={post.created_at} className="muted small">
          {formatDate(post.created_at)}
        </time>
        {user?.id === post.author_id && (
          <Link to={`/edit/${post.id}`} className="small">
            Edit
          </Link>
        )}
      </div>

      <div className="post-body">
        {post.content.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <Link to={blogPath(author.username)} className="btn btn-ghost">
        ← More from {name}
      </Link>

      {/* Commenting is gated on publication by RLS, so only offer it when live. */}
      {post.published ? (
        <Comments postId={post.id} postAuthorId={post.author_id} />
      ) : (
        <p className="muted small comments">Comments open once this post is published.</p>
      )}
    </article>
  )
}
