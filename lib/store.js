// Global app state — shared via Supabase when enabled, falls back to localStorage.
// Writes are debounced (800ms) to avoid hammering the DB on every keystroke.

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { loadData, saveData, DEFAULT_DATA } from './storage'
import { useAuth } from './auth'
import { getSupabase, supabaseEnabled } from './supabase'

const StoreContext = createContext(null)
const SAVE_DEBOUNCE_MS = 800

export function StoreProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(DEFAULT_DATA)
  const [loaded, setLoaded] = useState(false)
  const [toasts, setToasts] = useState([])
  const saveTimer = useRef(null)
  const lastSaved = useRef(null)
  const skipNextSave = useRef(true)

  // Load (cloud if available + logged in, else local)
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    skipNextSave.current = true
    ;(async () => {
      const d = await loadData({ cloud: !!user && supabaseEnabled, userEmail: user?.email })
      if (cancelled) return
      lastSaved.current = JSON.stringify(d)
      setData(d)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [user, authLoading])

  // Persist on change (debounced) + theme attribute
  useEffect(() => {
    if (!loaded) return
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', data.theme || 'dark')
    }
    if (skipNextSave.current) { skipNextSave.current = false; return }

    const serialized = JSON.stringify(data)
    if (serialized === lastSaved.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      lastSaved.current = serialized
      await saveData(data, { cloud: !!user && supabaseEnabled, userEmail: user?.email })
    }, SAVE_DEBOUNCE_MS)

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [data, loaded, user])

  // Realtime: when someone else updates app_state, refresh.
  useEffect(() => {
    if (!supabaseEnabled || !user) return
    const sb = getSupabase()
    if (!sb) return
    const channel = sb
      .channel('app_state-changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.singleton' },
        async (payload) => {
          const incoming = payload.new?.data
          const incomingBy = payload.new?.updated_by
          if (!incoming) return
          // Ignore our own writes (avoid feedback loop)
          if (incomingBy === user.email && JSON.stringify(incoming) === lastSaved.current) return
          skipNextSave.current = true
          lastSaved.current = JSON.stringify(incoming)
          setData(prev => ({ ...prev, ...incoming, research: { ...prev.research, ...(incoming.research || {}) } }))
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [user])

  const update = useCallback((patch) => {
    setData(d => (typeof patch === 'function' ? patch(d) : { ...d, ...patch }))
  }, [])

  const updateResearch = useCallback((patch) => {
    setData(d => ({
      ...d,
      research: typeof patch === 'function' ? patch(d.research) : { ...d.research, ...patch }
    }))
  }, [])

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const value = { data, loaded, update, updateResearch, toast, toasts, setData }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
