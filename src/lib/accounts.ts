import { supabase } from './supabase'
import type { PendingAccount, Profile } from '../types/database'

export type RegistrationDetails = {
  fullName: string
  email: string
  password: string
  program: string
  yearLevel: number
}

export async function registerAccount(details: RegistrationDetails) {
  // Only descriptive fields go in the metadata. The database creates the
  // profile as pending and ignores any approval or admin values sent here.
  const { data, error } = await supabase.auth.signUp({
    email: details.email,
    password: details.password,
    options: {
      data: {
        full_name: details.fullName,
        program: details.program,
        year_level: details.yearLevel,
      },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPendingAccounts(): Promise<PendingAccount[]> {
  const { data, error } = await supabase.rpc('pending_accounts')
  if (error) throw error
  return data
}

// The database checks that the caller is an approved admin and records the
// reviewer and time; the browser cannot set those values itself.
export async function reviewAccount(profileId: string, decision: 'approved' | 'rejected') {
  const { error } = await supabase.rpc('review_account', {
    target_profile_id: profileId,
    decision,
  })
  if (error) throw error
}
