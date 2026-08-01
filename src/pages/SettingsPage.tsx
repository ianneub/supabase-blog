import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { USERNAME_PATTERN, blogPath, normalizeUsername } from '../lib/slug'
import { useAuth } from '../context/auth-context'
import Avatar from '../components/Avatar'

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username)
    setDisplayName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
  }, [profile])

  if (!profile) return <p className="muted">Loading…</p>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const nextUsername = normalizeUsername(username)
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError('Usernames use letters, numbers and single hyphens, up to 39 characters.')
      return
    }

    setBusy(true)
    setError(null)
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        username: nextUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq('id', user.id)

    setBusy(false)

    if (error) {
      setError(
        error.code === '23505' ? `The username "${nextUsername}" is taken.` : error.message,
      )
      return
    }

    setUsername(nextUsername)
    setSaved(true)
    await refreshProfile()
  }

  const name = profile.display_name || profile.username

  return (
    <div className="narrow">
      <h1 className="page-title">Profile settings</h1>

      <div className="profile-header">
        <Avatar url={profile.avatar_url} name={name} size={56} />
        <p className="muted small">
          Your avatar comes from GitHub. Your blog is at{' '}
          <Link to={blogPath(profile.username)}>
            <code>/@{profile.username}</code>
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={39}
            required
          />
          <span className="hint">
            Changing this changes every link to your blog: /@{normalizeUsername(username) || '…'}
          </span>
        </label>

        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder={profile.username}
          />
        </label>

        <label>
          Bio <span className="hint">optional — shown at the top of your blog</span>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} />
        </label>

        {error && <p className="error">{error}</p>}
        {saved && <p className="notice">Saved.</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
