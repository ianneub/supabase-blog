import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Post } from '../lib/database.types'
import { blogPath, formatDate, postPath } from '../lib/slug'
import { useAuth } from '../context/auth-context'

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) setError(error.message)
    else setPosts(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function togglePublished(post: Post) {
    const { error } = await supabase
      .from('posts')
      .update({ published: !post.published })
      .eq('id', post.id)

    if (error) setError(error.message)
    else load()
  }

  async function remove(post: Post) {
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) setError(error.message)
    else load()
  }

  if (loading) return <p className="muted">Loading your posts…</p>

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">Your posts</h1>
        <div className="actions">
          <Link to="/settings" className="btn btn-ghost btn-sm">
            Settings
          </Link>
          <Link to="/new" className="btn btn-primary btn-sm">
            Write
          </Link>
        </div>
      </div>

      {profile && (
        <p className="muted small">
          Your blog lives at{' '}
          <Link to={blogPath(profile.username)}>
            <code>/@{profile.username}</code>
          </Link>
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {posts.length === 0 ? (
        <p className="muted">Nothing here yet. Write your first post.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  {profile ? (
                    <Link to={postPath(profile.username, post.slug)}>{post.title}</Link>
                  ) : (
                    post.title
                  )}
                </td>
                <td>
                  <span className={post.published ? 'pill pill-live' : 'pill'}>
                    {post.published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="muted small">{formatDate(post.updated_at)}</td>
                <td className="actions">
                  <Link to={`/edit/${post.id}`} className="btn btn-ghost btn-sm">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => togglePublished(post)}
                  >
                    {post.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(post)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
