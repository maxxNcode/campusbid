import { supabase } from './supabase'
import { generatedPhotoPath, type ItemCondition, type ListingDraft } from './listing-rules'
import type { Category, Listing } from '../types/database'

export const PHOTO_BUCKET = 'listing-photos'
const SIGNED_URL_SECONDS = 60 * 60

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data
}

// Returns null when the listing does not exist or the viewer may not see it.
export async function fetchListing(id: number): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

function draftToColumns(draft: ListingDraft) {
  const optional = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category_id: Number(draft.categoryId),
    program: draft.program,
    // Already checked to be digits with at most two decimals. Number() only
    // changes the JSON type; Postgres stores it as numeric(10,2).
    price: Number(draft.price.trim()),
    condition: draft.condition as ItemCondition,
    model_or_edition: optional(draft.modelOrEdition),
    included_parts: optional(draft.includedParts),
    known_defects: draft.knownDefects.trim(),
  }
}

// Names of approved members, keyed by id. Other members' profile rows are
// not readable, so names come from the narrow member_names() function.
export async function fetchMemberNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  const names = new Map<string, string>()
  if (unique.length === 0) return names
  const { data, error } = await supabase.rpc('member_names', { member_ids: unique })
  if (error) throw error
  for (const member of data) names.set(member.id, member.full_name)
  return names
}

// The seller's own listings in every status, newest first.
export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Withdraws an available listing. The database checks ownership and status
// again and cancels pending requests on it; request rows are kept.
export async function withdrawListing(id: number): Promise<Listing> {
  const { data, error } = await supabase.rpc('withdraw_listing', { target_listing_id: id })
  if (error) throw error
  return data
}

export async function uploadListingPhoto(userId: string, file: File): Promise<string> {
  const path = generatedPhotoPath(userId, file.type)
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeListingPhoto(path: string) {
  await supabase.storage.from(PHOTO_BUCKET).remove([path])
}

// seller_id and status are not sent: the database fills them in.
export async function createListing(draft: ListingDraft, photoPath: string): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .insert({ ...draftToColumns(draft), photo_path: photoPath })
    .select()
    .single()
  if (error) throw error
  return data
}

export class ListingNotEditableError extends Error {}

export async function updateListing(id: number, draft: ListingDraft, photoPath: string | null): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({ ...draftToColumns(draft), photo_path: photoPath })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  // No row back means the listing is no longer active (or not yours).
  if (!data) throw new ListingNotEditableError('This listing can no longer be edited.')
  return data
}

// Signed links to private photos, keyed by storage path.
export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  if (paths.length === 0) return urls
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) return urls
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}
