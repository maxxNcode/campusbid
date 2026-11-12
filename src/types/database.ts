// Database types in the shape produced by `supabase gen types typescript`.
// Regenerate after each migration once the Supabase project exists (see README).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          program: string
          year_level: number
          is_admin: boolean
          approval_status: Database['public']['Enums']['approval_status']
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          program: string
          year_level: number
          is_admin?: boolean
          approval_status?: Database['public']['Enums']['approval_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          program?: string
          year_level?: number
          is_admin?: boolean
          approval_status?: Database['public']['Enums']['approval_status']
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: number
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: never
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: never
          name?: string
          slug?: string
          created_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          id: number
          seller_id: string
          category_id: number
          program: string
          title: string
          description: string
          price: number
          condition: Database['public']['Enums']['item_condition']
          model_or_edition: string | null
          included_parts: string | null
          known_defects: string
          photo_path: string | null
          status: Database['public']['Enums']['listing_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          seller_id?: string
          category_id: number
          program: string
          title: string
          description: string
          price: number
          condition: Database['public']['Enums']['item_condition']
          model_or_edition?: string | null
          included_parts?: string | null
          known_defects: string
          photo_path?: string | null
          status?: Database['public']['Enums']['listing_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          seller_id?: string
          category_id?: number
          program?: string
          title?: string
          description?: string
          price?: number
          condition?: Database['public']['Enums']['item_condition']
          model_or_edition?: string | null
          included_parts?: string | null
          known_defects?: string
          photo_path?: string | null
          status?: Database['public']['Enums']['listing_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listings_seller_id_fkey'
            columns: ['seller_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'listings_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_requests: {
        Row: {
          id: number
          listing_id: number
          buyer_id: string
          note: string | null
          status: Database['public']['Enums']['request_status']
          meetup_place: string
          meetup_at: string
          accepted_at: string | null
          completed_at: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          listing_id: number
          buyer_id?: string
          note?: string | null
          status?: Database['public']['Enums']['request_status']
          meetup_place: string
          meetup_at: string
          accepted_at?: string | null
          completed_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          listing_id?: number
          buyer_id?: string
          note?: string | null
          status?: Database['public']['Enums']['request_status']
          meetup_place?: string
          meetup_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_requests_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'listings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_requests_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_user_is_approved: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      pending_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          full_name: string
          program: string
          year_level: number
          created_at: string
        }[]
      }
      review_account: {
        Args: {
          target_profile_id: string
          decision: Database['public']['Enums']['approval_status']
        }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
    }
    Enums: {
      approval_status: 'pending' | 'approved' | 'rejected'
      item_condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'
      listing_status: 'active' | 'reserved' | 'sold' | 'withdrawn'
      request_status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Profile = PublicSchema['Tables']['profiles']['Row']
export type Category = PublicSchema['Tables']['categories']['Row']
export type Listing = PublicSchema['Tables']['listings']['Row']
export type PurchaseRequest = PublicSchema['Tables']['purchase_requests']['Row']
export type ApprovalStatus = PublicSchema['Enums']['approval_status']
export type PendingAccount = PublicSchema['Functions']['pending_accounts']['Returns'][number]
