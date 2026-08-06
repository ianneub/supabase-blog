import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../context/auth-context'
import { USERNAME_PATTERN, normalizeUsername } from '../lib/slug'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { user, loading, signInWithGitHub, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null)

  if (loading) return <p className="muted">Loading…</p>
  if (user) return <Navigate to="/dashboard" replace />

  if (confirmSentTo) {
    return (
      <div className="narrow center">
        <h1 className="page-title">Check your email</h1>
        <p className="muted">
          If <strong>{confirmSentTo}</strong> can have an account, a confirmation link is on its
          way. Open it and you will be signed in and taken to your dashboard.
        </p>
        <p className="muted small">
          The link expires after an hour. Nothing arrived? Check spam, then{' '}
          <button type="button" className="link-button" onClick={() => setConfirmSentTo(null)}>
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleGitHub() {
    setBusy(true)
    setError(null)
    const { error } = await signInWithGitHub()
    if (error) {
      setBusy(false)
      setError(error)
    }
    // On success the browser is redirected to GitHub, so nothing to do here.
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup') {
      const wanted = normalizeUsername(username)
      if (!USERNAME_PATTERN.test(wanted)) {
        setError('Usernames use letters, numbers and single hyphens, up to 39 characters.')
        return
      }

      setBusy(true)
      const { error, confirmationSent } = await signUpWithEmail(email.trim(), password, wanted)
      setBusy(false)

      if (error) {
        setError(error)
        return
      }
      // With confirmations off in the Supabase project, sign-up returns a live
      // session instead and the redirect above takes over on the next render.
      if (confirmationSent) setConfirmSentTo(email.trim())
      return
    }

    setBusy(true)
    const { error } = await signInWithEmail(email.trim(), password)
    setBusy(false)
    if (error) setError(error)
  }

  const signingUp = mode === 'signup'

  return (
    <div className="narrow">
      <h1 className="page-title">{signingUp ? 'Start your blog' : 'Welcome back'}</h1>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!signingUp}
          className={`tab ${!signingUp ? 'tab-active' : ''}`}
          onClick={() => switchMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={signingUp}
          className={`tab ${signingUp ? 'tab-active' : ''}`}
          onClick={() => switchMode('signup')}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form">
        {signingUp && (
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={39}
              autoComplete="username"
              required
            />
            <span className="hint">
              Your blog lives at /@{normalizeUsername(username) || '…'} — you can change it later
              in settings.
            </span>
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
          />
          {signingUp && <span className="hint">At least 6 characters.</span>}
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Working…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
          {!signingUp && <Link to="/forgot-password">Forgot your password?</Link>}
        </div>
      </form>

      <div className="or-divider">
        <span>or</span>
      </div>

      <button type="button" className="btn btn-github" onClick={handleGitHub} disabled={busy}>
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {busy ? 'Redirecting…' : 'Continue with GitHub'}
      </button>

      <p className="muted small">
        You do not need an account to read posts or leave a comment — signing in is only for
        publishing.
      </p>
    </div>
  )
}
