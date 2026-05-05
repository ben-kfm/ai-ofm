// Lightweight global store using React Context — single source of truth
// for the whole AI OFM app. All pages read & update via useStore().

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loadData, saveData, DEFAULT_DATA } from './storage'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [data, setData] = useState(DEFAULT_DATA)
  const [loaded, setLoaded] = useState(false)
  const [toasts, setToasts] = useState([])

  // Load on mount
  useEffect(() => {
    setData(loadData())
    setLoaded(true)
  }, [])

  // Persist + theme
  useEffect(() => {
    if (!loaded) return
    saveData(data)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', data.theme || 'dark')
    }
  }, [data, loaded])

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
