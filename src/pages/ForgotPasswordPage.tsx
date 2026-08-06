import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/auth-context'

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const address = email.trim()
    const { error } = await sendPasswordReset(address)
    setBusy(false)

    // Supabase succeeds whether or not the address has an account, so that a
    // stranger cannot use this form to discover who is registered. Say the same
    // thing either way.
    if (error) setError(error)
    else setSentTo(address)
  }

  if (sentTo) {
    return (
      <div className="narrow center">
        <h1 className="page-title">Check your email</h1>
        <p className="muted">
          If <strong>{sentTo}</strong> has an account, a link to choose a new password is on its
          way. It expires after an hour.
        </p>
        <p className="muted small">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="narrow">
      <h1 className="page-title">Reset your password</h1>
      <p className="muted">
        Enter the email address on your account and we will send you a link to set a new password.
      </p>

      <form onSubmit={handleSubmit} className="form">
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

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  )
}
