// Supabase client — browser-side singleton.

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON)

let _client = null
export function getSupabase() {
  if (!supabaseEnabled) return null
  if (typeof window === 'undefined') return null
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    })
  }
  return _client
}
