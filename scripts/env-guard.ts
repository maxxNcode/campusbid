// Shared guard for scripts that delete or create demo data.
export function developmentGuardProblem(env: Record<string, string | undefined>): string | null {
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.DEMO_ACCOUNT_PASSWORD) {
    return 'Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_ACCOUNT_PASSWORD in .env first.'
  }
  if (env.CAMPUSBID_ENVIRONMENT !== 'development') {
    return 'Refusing to touch demo data: set CAMPUSBID_ENVIRONMENT=development in .env, and only for a development Supabase project.'
  }
  if (env.DEMO_ACCOUNT_PASSWORD.length < 8) return 'DEMO_ACCOUNT_PASSWORD must be at least 8 characters.'
  return null
}
