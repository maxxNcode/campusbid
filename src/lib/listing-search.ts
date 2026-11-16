// Marketplace search. Takes the Supabase client as an argument so the
// integration tests run exactly the query the Browse page runs.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Listing } from '../types/database'

export const PAGE_SIZE = 12
const MAX_KEYWORD_WORDS = 5

export type ListingFilters = {
  keyword: string
  categoryId: number | null
  program: string | null
  includeReserved: boolean
  page: number // 1-based
}

export type ListingPage = {
  listings: Listing[]
  total: number
  pageCount: number
  // True when the requested page is past the last one.
  pastEnd: boolean
}

// Keeps letters, digits and hyphens, so the words are safe inside a
// PostgREST filter string. "fx-991ES calculator" -> ['fx-991ES', 'calculator'].
export function keywordWords(keyword: string): string[] {
  return keyword
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.replace(/-/g, '') !== '')
    .slice(0, MAX_KEYWORD_WORDS)
}

export async function searchListings(
  client: SupabaseClient<Database>,
  filters: ListingFilters,
): Promise<ListingPage> {
  const page = Math.max(1, Math.floor(filters.page))
  const from = (page - 1) * PAGE_SIZE

  let query = client.from('listings').select('*', { count: 'exact' })

  // Available items only, unless the viewer asks to see reserved ones too.
  // Sold and withdrawn listings never appear in Browse.
  query = filters.includeReserved ? query.in('status', ['active', 'reserved']) : query.eq('status', 'active')

  // Every word must appear in the title, description or model/edition.
  for (const word of keywordWords(filters.keyword)) {
    const pattern = `%${word}%`
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern},model_or_edition.ilike.${pattern}`)
  }
  if (filters.categoryId !== null) query = query.eq('category_id', filters.categoryId)
  if (filters.program) query = query.eq('program', filters.program)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  // Asking for a page past the end returns a range error.
  if (error && error.code === 'PGRST103') return { listings: [], total: 0, pageCount: 0, pastEnd: true }
  if (error) throw error
  const total = count ?? 0
  const pageCount = Math.ceil(total / PAGE_SIZE)
  return { listings: data, total, pageCount, pastEnd: page > 1 && page > pageCount }
}
