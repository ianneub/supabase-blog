import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { postPath, slugify } from '../lib/slug'
import { useAuth } from '../context/auth-context'

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id!)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setError(error.message)
      } else if (data) {
        setTitle(data.title)
        setSlug(data.slug)
        setSlugTouched(true)
        setExcerpt(data.excerpt ?? '')
        setContent(data.content)
        setPublished(data.published)
      } else {
        setError('Post not found, or you do not have access to it.')
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // Keep the slug in sync with the title until the author edits it by hand.
  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const finalSlug = slugify(slug || title)
    if (!finalSlug) {
      setError('Give the post a title or slug containing at least one letter or number.')
      return
    }

    setBusy(true)
    setError(null)

    const fields = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim() || null,
      content,
      published,
    }

    const { data, error } = isEdit
      ? await supabase.from('posts').update(fields).eq('id', id!).select('slug').single()
      : await supabase
          .from('posts')
          .insert({ ...fields, author_id: user.id })
          .select('slug')
          .single()

    setBusy(false)

    if (error) {
      // Slugs are unique per author, so a clash only ever collides with your own posts.
      setError(
        error.code === '23505'
          ? `You already have a post at "${finalSlug}". Pick a different slug.`
          : error.message,
      )
      return
    }

    navigate(profile ? postPath(profile.username, data.slug) : '/dashboard')
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="narrow">
      <h1 className="page-title">{isEdit ? 'Edit post' : 'New post'}</h1>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Title
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label>
          Slug
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            required
          />
          <span className="hint">
            /@{profile?.username ?? 'you'}/{slugify(slug || title) || '…'}
          </span>
        </label>

        <label>
          Excerpt <span className="hint">optional — shown on the index page</span>
          <textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>

        <label>
          Content <span className="hint">blank lines separate paragraphs</span>
          <textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} />
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Publish (visible to everyone, and open for comments)
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create post'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
