import { supabase } from './supabase'
import type { Profile } from '../types/database'

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
