import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchProfile } from '../lib/accounts'
import { AuthContext } from '../lib/auth-context'
import type { Profile } from '../types/database'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionChecked(true)
    })

    // Keep this callback synchronous: Supabase advises against awaiting other
    // Supabase calls inside it. The profile is loaded by the effect below.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionChecked(true)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // Loads the signed-in user's profile whenever the user changes.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId)
      .catch(() => null)
      .then((loadedProfile) => {
        if (cancelled) return
        setProfile(loadedProfile)
        setProfileUserId(userId)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Used after an admin decision, e.g. the "Check again" button on the pending page.
  const refreshProfile = useCallback(async () => {
    if (!userId) return
    try {
      setProfile(await fetchProfile(userId))
    } catch {
      setProfile(null)
    }
  }, [userId])

  const loading = !sessionChecked || (userId !== null && profileUserId !== userId)

  return (
    <AuthContext.Provider
      value={{ session, profile: userId ? profile : null, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
