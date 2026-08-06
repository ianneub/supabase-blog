import type { AuthError } from '@supabase/supabase-js'

// Supabase's `code` values are a stable API; the `message` strings are not, so
// match on the code and only fall back to the raw message for the long tail.
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password do not match an account.'
    case 'email_not_confirmed':
      return 'Confirm your email address first — check your inbox for the link.'
    case 'user_already_exists':
      return 'An account with that email already exists. Try signing in instead.'
    case 'weak_password':
      return 'That password is too weak. Use at least 6 characters.'
    case 'same_password':
      return 'That is already your password. Choose a different one.'
    case 'over_email_send_rate_limit':
      return 'Too many emails sent to that address. Wait a few minutes and try again.'
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Email sign-ups are turned off for this site.'
    default:
      return error.message
  }
}
