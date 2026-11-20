import { supabase } from './supabase'
import { fetchMyListings } from './listings'
import type { Listing, MeetupPlace, PurchaseRequest } from '../types/database'

// Messages written for people come from the database functions (error codes
// P0001, P0002 and 42501). Anything else gets a general message.
export function requestErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === 'P0001' || error.code === 'P0002' || error.code === '42501') return error.message
  return 'Something went wrong. Check your connection and try again.'
}

export async function fetchMeetupPlaces(): Promise<MeetupPlace[]> {
  const { data, error } = await supabase
    .from('meetup_places')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data
}

export async function fetchMyRequestForListing(listingId: number, buyerId: string): Promise<PurchaseRequest | null> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchRequest(id: number): Promise<PurchaseRequest | null> {
  const { data, error } = await supabase.from('purchase_requests').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function sendPurchaseRequest(
  listingId: number,
  note: string,
  place: string,
  meetupIso: string,
): Promise<PurchaseRequest> {
  const { data, error } = await supabase.rpc('send_purchase_request', {
    target_listing_id: listingId,
    request_note: note.trim() === '' ? null : note,
    place,
    meetup_time: meetupIso,
  })
  if (error) throw error
  return data
}

export async function acceptPurchaseRequest(id: number): Promise<PurchaseRequest> {
  const { data, error } = await supabase.rpc('accept_purchase_request', { target_request_id: id })
  if (error) throw error
  return data
}

export async function declinePurchaseRequest(id: number, reason: string): Promise<PurchaseRequest> {
  const { data, error } = await supabase.rpc('decline_purchase_request', {
    target_request_id: id,
    decline_reason: reason.trim() === '' ? null : reason,
  })
  if (error) throw error
  return data
}

export async function cancelPurchaseRequest(id: number, reason: string): Promise<PurchaseRequest> {
  const { data, error } = await supabase.rpc('cancel_purchase_request', { target_request_id: id, cancel_reason: reason })
  if (error) throw error
  return data
}

export async function completePurchaseRequest(id: number): Promise<PurchaseRequest> {
  const { data, error } = await supabase.rpc('complete_purchase_request', { target_request_id: id })
  if (error) throw error
  return data
}

// Requests on the signed-in member's own listings, newest first.
export async function fetchRequestsReceived(userId: string): Promise<{ requests: PurchaseRequest[]; listings: Map<number, Listing> }> {
  const mine = await fetchMyListings(userId)
  const listings = new Map(mine.map((listing) => [listing.id, listing]))
  if (mine.length === 0) return { requests: [], listings }
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .in('listing_id', [...listings.keys()])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return { requests: data, listings }
}

// Requests the signed-in member sent as a buyer, newest first.
export async function fetchMyRequests(userId: string): Promise<{ requests: PurchaseRequest[]; listings: Map<number, Listing> }> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  const listings = new Map<number, Listing>()
  const ids = [...new Set(data.map((request) => request.listing_id))]
  if (ids.length > 0) {
    const { data: rows, error: listingError } = await supabase.from('listings').select('*').in('id', ids)
    if (listingError) throw listingError
    for (const listing of rows) listings.set(listing.id, listing)
  }
  return { requests: data, listings }
}
