import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import type { CommentInsert, CommentWithAuthor } from '../lib/database.types'
import { blogPath, formatDate } from '../lib/slug'
import { useAuth } from '../context/auth-context'
import Avatar from './Avatar'

const NAME_KEY = 'supabase-blog:anon-name'

type Props = {
  postId: string
  /** Author of the post, who can moderate any comment on it. */
  postAuthorId: string
}

export default function Comments({ postId, postAuthorId }: Props) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setComments((data ?? []) as CommentWithAuthor[])
    setLoading(false)
  }, [postId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return

    if (!user && !name.trim()) {
      setError('Add a name to comment anonymously.')
      return
    }

    setBusy(true)
    setError(null)

    // Signed in: attribute to the account. Signed out: send a display name only,
    // which is all the anon insert policy will accept.
    const payload: CommentInsert = user
      ? { post_id: postId, author_id: user.id, body: body.trim() }
      : { post_id: postId, author_name: name.trim(), body: body.trim() }

    if (!user) localStorage.setItem(NAME_KEY, name.trim())

    const { error } = await supabase.from('comments').insert(payload)
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    setBody('')
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const canModerate = user?.id === postAuthorId

  return (
    <section className="comments">
      <h2 className="comments-title">
        {comments.length === 0
          ? 'Comments'
          : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
      </h2>

      {loading ? (
        <p className="muted small">Loading comments…</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => {
            const author = c.profiles
            const displayName = author
              ? author.display_name || author.username
              : c.author_name || 'Anonymous'
            const mine = Boolean(c.author_id) && c.author_id === user?.id

            return (
              <li key={c.id} className="comment">
                <Avatar url={author?.avatar_url} name={displayName} size={30} />
                <div className="comment-main">
                  <div className="byline">
                    {author ? (
                      <Link to={blogPath(author.username)} className="comment-author">
                        {displayName}
                      </Link>
                    ) : (
                      <span className="comment-author">
                        {displayName} <span className="pill">guest</span>
                      </span>
                    )}
                    <time dateTime={c.created_at} className="muted small">
                      {formatDate(c.created_at)}
                    </time>
                    {(mine || canModerate) && (
                      <button
                        type="button"
                        className="link-button small danger"
                        onClick={() => remove(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="comment-body">{c.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="form comment-form">
        {user ? (
          <p className="muted small">
            Commenting as <strong>{profile?.display_name || profile?.username || user.email}</strong>
          </p>
        ) : (
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
              required
            />
            <span className="hint">
              Or <Link to="/login">sign in</Link> to comment under your account.
            </span>
          </label>
        )}

        <label>
          Comment
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
    </section>
  )
}
