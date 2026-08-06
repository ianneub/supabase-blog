import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/auth-errors'
import type { Profile } from '../lib/database.types'
import { AuthContext } from './auth-context'
import type { AuthValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    setProfile(data)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // The profile row is created by an on-signup trigger. On a brand-new account
    // the row can lag the session by a moment, so retry briefly.
    async function loadWithRetry() {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId!)
          .maybeSingle()

        if (cancelled) return
        if (data) {
          setProfile(data)
          break
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
      }
      if (!cancelled) setLoading(false)
    }

    loadWithRetry()
    return () => {
      cancelled = true
    }
  }, [userId])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile: async () => {
        if (userId) await loadProfile(userId)
      },
      signInWithGitHub: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: `${window.location.origin}/dashboard` },
        })
        return { error: error?.message ?? null }
      },
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? authErrorMessage(error) : null }
      },
      signUpWithEmail: async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            // The on-signup trigger reads `user_name` out of raw_user_meta_data to
            // build profiles.username, the same key the GitHub provider supplies.
            // It sanitises and de-duplicates whatever lands here, so a requested
            // name that is taken silently becomes "name-1".
            data: { user_name: username },
          },
        })
        if (error) return { error: authErrorMessage(error), confirmationSent: false }

        // Signing up with an address that already has an account succeeds here too,
        // with no session and no error — that is Supabase declining to reveal who is
        // already registered. Both cases get the same "check your inbox" screen; a
        // distinct message would hand out the answer Supabase just withheld.
        return { error: null, confirmationSent: !data.session }
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        return { error: error ? authErrorMessage(error) : null }
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        return { error: error ? authErrorMessage(error) : null }
      },
      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },
    }),
    [session, profile, loading, userId, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
