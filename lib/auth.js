// Auth helpers + React context.
//
// - Wraps the app with <AuthProvider>
// - Exposes useAuth(): { user, isAdmin, loading, signOut }
// - Verifies allowlist after every sign-in; if not allowed, signs out + redirects to /login
// - In dev/preview without Supabase env vars, falls back to "no-auth" mode.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSupabase, supabaseEnabled } from './supabase'

const AuthCtx = createContext(null)
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/error']

export function AuthProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastChecked = useRef(null)

  useEffect(() => {
    // No Supabase configured → bypass auth (local dev mode)
    if (!supabaseEnabled) {
      setUser({ email: 'local@dev', id: 'local' })
      setIsAdmin(true)
      setLoading(false)
      return
    }

    const sb = getSupabase()
    if (!sb) { setLoading(false); return }

    let mounted = true

    async function refresh() {
      try {
        const { data: { user: u }, error: ue } = await sb.auth.getUser()
        if (!mounted) return
        if (ue || !u) {
          setUser(null); setIsAdmin(false); setLoading(false); return
        }
        // Avoid re-running the allowlist check on every onAuthStateChange tick
        if (lastChecked.current === u.email) {
          setLoading(false); return
        }
        lastChecked.current = u.email

        const { data: row, error: re } = await sb
          .from('allowed_users')
          .select('is_admin')
          .eq('email', u.email)
          .maybeSingle()
        if (!mounted) return
        if (re) {
          setError(re.message)
          setUser(null); setIsAdmin(false); setLoading(false); return
        }
        if (!row) {
          // Not allow-listed → sign out and bounce.
          try { await sb.auth.signOut() } catch {}
          if (!mounted) return
          setUser(null); setIsAdmin(false); setLoading(false)
          if (router.pathname !== '/auth/error') router.replace('/auth/error?reason=not_allowed')
          return
        }
        setUser({ id: u.id, email: u.email })
        setIsAdmin(Boolean(row.is_admin))
        setLoading(false)
      } catch (e) {
        if (!mounted) return
        setError(e?.message)
        setUser(null); setIsAdmin(false); setLoading(false)
      }
    }

    refresh()
    const { data: sub } = sb.auth.onAuthStateChange(() => refresh())
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [router])

  // Route protection
  useEffect(() => {
    if (loading) return
    if (!user && !PUBLIC_ROUTES.includes(router.pathname)) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
    }
    if (user && router.pathname === '/login') {
      router.replace('/content-research')
    }
  }, [user, loading, router])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (sb) { try { await sb.auth.signOut() } catch {} }
    setUser(null); setIsAdmin(false)
    lastChecked.current = null
    router.replace('/login')
  }, [router])

  const value = { user, isAdmin, loading, error, signOut, supabaseEnabled }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
