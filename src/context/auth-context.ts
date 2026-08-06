import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../lib/database.types'

export type AuthValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signInWithGitHub: () => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  /**
   * `confirmationSent` is true when Supabase issued a confirmation email rather
   * than a session, which is every successful sign-up while "Confirm email" is on.
   * It is deliberately true for an address that already has an account too — see
   * the note in AuthContext.
   */
  signUpWithEmail: (
    email: string,
    password: string,
    username: string,
  ) => Promise<{ error: string | null; confirmationSent: boolean }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | undefined>(undefined)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
