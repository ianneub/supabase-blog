import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../context/auth-context'

/**
 * A recovery link that is expired or already spent does not fail the code
 * exchange — Supabase bounces back to this page with the reason in the URL, in
 * the query string for the PKCE flow and in the fragment for the implicit one.
 * Read it on the first render, before the client can strip it.
 */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  return (
    hash.get('error_description') ??
    query.get('error_description') ??
    hash.get('error') ??
    query.get('error')
  )
}

export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth()
  const [linkError] = useState(readLinkError)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Setting the password leaves the recovery session in place, so this lands on
  // the dashboard already signed in.
  if (done) return <Navigate to="/dashboard" replace />
  if (loading) return <p className="muted">Loading…</p>

  // Opening the link signs the user in behind the scenes; no session here means
  // the link never worked.
  if (linkError || !user) {
    return (
      <div className="narrow center">
        <h1 className="page-title">That link has expired</h1>
        <p className="muted">
          {linkError ?? 'Password reset links can only be opened once, and they last an hour.'}
        </p>
        <p className="muted small">
          <Link to="/forgot-password">Send yourself a new one</Link>
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Those two passwords do not match.')
      return
    }

    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)

    if (error) setError(error)
    else setDone(true)
  }

  return (
    <div className="narrow">
      <h1 className="page-title">Choose a new password</h1>
      <p className="muted">
        Setting a password for <strong>{user.email}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
          <span className="hint">At least 6 characters.</span>
        </label>

        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </form>
    </div>
  )
}
