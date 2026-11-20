import { supabase } from './supabase'
import type { MeetupPlace, PurchaseRequest } from '../types/database'

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
