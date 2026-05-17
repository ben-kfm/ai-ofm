// Auth helpers + React context.
//
// - Wraps the app with <AuthProvider>
// - Exposes useAuth(): { user, isAdmin, loading, signOut }
// - Verifies allowlist after every sign-in; if not allowed, signs out + redirects to /login
// - In dev/preview without Supabase env vars, falls back to "no-auth" mode where
//   isAdmin=true and user has the seed admin email, so the UI keeps working.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  // When Supabase isn't configured (early dev), behave as logged-in admin so the app still works.
  useEffect(() => {
    if (!supabaseEnabled) {
      setUser({ email: 'local@dev', id: 'local' })
      setIsAdmin(true)
      setLoading(false)
      return
    }

    const sb = getSupabase()
    if (!sb) return

    let mounted = true
    let checking = false

    async function verifyAllowlist(u) {
      if (!u) return { allowed: false, isAdmin: false }
      const { data, error } = await sb
        .from('allowed_users')
        .select('is_admin')
        .eq('email', u.email)
        .maybeSingle()
      if (error) return { allowed: false, isAdmin: false, errorMsg: error.message }
      return { allowed: Boolean(data), isAdmin: Boolean(data?.is_admin) }
    }

    async function handleSession(session) {
      if (checking) return
      checking = true
      try {
        const u = session?.user || null
        if (!u) {
          if (mounted) { setUser(null); setIsAdmin(false); setLoading(false) }
          return
        }
        const { allowed, isAdmin, errorMsg } = await verifyAllowlist(u)
        if (!mounted) return
        if (!allowed) {
          setError(errorMsg || 'Diese E-Mail-Adresse ist nicht freigeschaltet. Frag den Admin.')
          await sb.auth.signOut()
          setUser(null); setIsAdmin(false); setLoading(false)
          if (router.pathname !== '/auth/error') router.replace('/auth/error?reason=not_allowed')
          return
        }
        setUser({ id: u.id, email: u.email })
        setIsAdmin(isAdmin)
        setLoading(false)
      } finally {
        checking = false
      }
    }

    sb.auth.getSession().then(({ data }) => handleSession(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => handleSession(session))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [router])

  // Route protection: redirect to /login when no user (after loading) on private routes.
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
    if (sb) await sb.auth.signOut()
    setUser(null); setIsAdmin(false)
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
