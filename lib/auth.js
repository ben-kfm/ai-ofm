// Auth helpers + React context.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSupabase, supabaseEnabled } from './supabase'

const AuthCtx = createContext(null)
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/error']

// Read auth cookie set by @supabase/ssr and extract the user payload synchronously.
// Avoids a network call to /auth/v1/user which can hang in some configurations.
function readUserFromCookie() {
  if (typeof document === 'undefined') return null
  try {
    const raw = document.cookie.split(';').find(c => c.trim().match(/^sb-.*-auth-token=/))
    if (!raw) return null
    const val = decodeURIComponent(raw.split('=').slice(1).join('='))
    const json = val.startsWith('base64-') ? atob(val.slice(7)) : val
    const parsed = JSON.parse(json)
    const u = parsed?.user
    if (!u) return null
    return { id: u.id, email: u.email, access_token: parsed.access_token }
  } catch (e) {
    return null
  }
}

export function AuthProvider({ children }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const lastChecked = useRef(null)
  const mountedRef = useRef(false)

  // Bootstrap once on mount
  useEffect(() => {
    mountedRef.current = true

    if (!supabaseEnabled) {
      setUser({ email: 'local@dev', id: 'local' })
      setIsAdmin(true)
      setLoading(false)
      return () => { mountedRef.current = false }
    }

    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return () => { mountedRef.current = false }
    }

    async function refresh() {
      try {
        const cookieUser = readUserFromCookie()
        if (!cookieUser) {
          if (!mountedRef.current) return
          setUser(null); setIsAdmin(false); setLoading(false)
          return
        }
        if (lastChecked.current === cookieUser.email) {
          if (mountedRef.current) setLoading(false)
          return
        }
        lastChecked.current = cookieUser.email

        const { data: row, error: re } = await sb
          .from('allowed_users')
          .select('is_admin')
          .eq('email', cookieUser.email)
          .maybeSingle()
        if (!mountedRef.current) return
        if (re) {
          setError(re.message)
          setUser(null); setIsAdmin(false); setLoading(false)
          return
        }
        if (!row) {
          try { await sb.auth.signOut() } catch {}
          if (!mountedRef.current) return
          lastChecked.current = null
          setUser(null); setIsAdmin(false); setLoading(false)
          if (router.pathname !== '/auth/error') router.replace('/auth/error?reason=not_allowed')
          return
        }
        setUser({ id: cookieUser.id, email: cookieUser.email })
        setIsAdmin(Boolean(row.is_admin))
        setLoading(false)
      } catch (e) {
        if (!mountedRef.current) return
        setError(e?.message)
        setUser(null); setIsAdmin(false); setLoading(false)
      }
    }

    refresh()

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (['INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event)) return
      lastChecked.current = null
      refresh()
    })

    // Safety: never let loading hang longer than 4s
    const failsafe = setTimeout(() => {
      if (!mountedRef.current) return
      setLoading(false)
    }, 4000)

    return () => {
      mountedRef.current = false
      sub.subscription.unsubscribe()
      clearTimeout(failsafe)
    }
  }, [])

  // Route protection
  useEffect(() => {
    if (loading) return
    const path = router.pathname
    if (!user && !PUBLIC_ROUTES.includes(path)) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
    }
    if (user && path === '/login') {
      router.replace('/content-research')
    }
  }, [user, loading, router.pathname])

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
