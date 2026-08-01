import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'

export default function LoginPage() {
  const { user, loading, signInWithGitHub } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="muted">Loading…</p>
  if (user) return <Navigate to="/dashboard" replace />

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    const { error } = await signInWithGitHub()
    if (error) {
      setBusy(false)
      setError(error)
    }
    // On success the browser is redirected to GitHub, so nothing to do here.
  }

  return (
    <div className="narrow center">
      <h1 className="page-title">Start your blog</h1>
      <p className="muted">
        Sign in with GitHub and you get your own blog at <code>/@your-username</code>. Your
        GitHub name and avatar are used for your profile — you can change them in settings.
      </p>

      <button type="button" className="btn btn-github" onClick={handleSignIn} disabled={busy}>
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {busy ? 'Redirecting…' : 'Continue with GitHub'}
      </button>

      {error && <p className="error">{error}</p>}

      <p className="muted small">
        You do not need an account to read posts or leave a comment — signing in is only for
        publishing.
      </p>
    </div>
  )
}
