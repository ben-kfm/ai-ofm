// AI OFM storage layer
//
// Strategy:
// - If Supabase is configured AND user is authenticated → shared `app_state` row
//   (single JSON blob, last-write-wins, optional realtime sync).
// - Otherwise (dev/preview without Supabase) → localStorage (per-browser).
//
// We keep the same JSON shape as before so all components stay unchanged.

import { getSupabase, supabaseEnabled } from './supabase'

const LOCAL_KEY = 'ai_ofm_data_v3'
const LEGACY_KEYS = ['ai_ofm_data_v2', 'ai_ofm_data_v1', 'argus2_data_v2', 'argus2_data_v1']
const SINGLETON_ID = 'singleton'

export const DEFAULT_DATA = {
  theme: 'dark',
  apifyKeys: [],
  activeApifyKeyId: null,
  research: {
    projects: [{ id: 'default', name: 'Default', accounts: [] }],
    activeProjectId: 'default',
    accounts: [],
    sessions: [],
    kanban: { backlog: [], inprogress: [], done: [] },
    favorites: [],
    filter: 'viral',
    scraperType: 'posts',
    daysBack: 14,
    limit: 30
  }
}

function isBrowser() { return typeof window !== 'undefined' }

function mergeDefaults(parsed) {
  const r = parsed?.research || {}
  let projects = r.projects
  let activeProjectId = r.activeProjectId
  if (!Array.isArray(projects) || !projects.length) {
    projects = [{ id: 'default', name: 'Default', accounts: r.accounts || [] }]
    activeProjectId = 'default'
  }
  return {
    ...DEFAULT_DATA,
    ...(parsed || {}),
    research: {
      ...DEFAULT_DATA.research,
      ...r,
      projects,
      activeProjectId,
      kanban: { ...DEFAULT_DATA.research.kanban, ...(r.kanban || {}) }
    }
  }
}

function readLocal() {
  if (!isBrowser()) return DEFAULT_DATA
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return mergeDefaults(JSON.parse(raw))
    for (const k of LEGACY_KEYS) {
      const legacy = localStorage.getItem(k)
      if (legacy) {
        const migrated = mergeDefaults(JSON.parse(legacy))
        localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
  } catch (e) { console.error('Storage load error', e) }
  return DEFAULT_DATA
}

function writeLocal(data) {
  if (!isBrowser()) return
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) } catch {}
}

// --- Cloud (Supabase) ---

async function readCloud() {
  const sb = getSupabase()
  if (!sb) return DEFAULT_DATA
  const { data, error } = await sb
    .from('app_state')
    .select('data')
    .eq('id', SINGLETON_ID)
    .maybeSingle()
  if (error) { console.error('Cloud read error', error); return DEFAULT_DATA }
  if (!data?.data || !Object.keys(data.data).length) return DEFAULT_DATA
  return mergeDefaults(data.data)
}

async function writeCloud(data, userEmail) {
  const sb = getSupabase()
  if (!sb) return
  const { error } = await sb
    .from('app_state')
    .upsert({ id: SINGLETON_ID, data, updated_by: userEmail || null, updated_at: new Date().toISOString() })
  if (error) console.error('Cloud write error', error)
}

// --- Public API ---

export async function loadData({ cloud, userEmail } = {}) {
  if (cloud && supabaseEnabled) {
    const cloudData = await readCloud()
    // First-time import: if cloud is empty but local has content, push local to cloud.
    if (isBrowser()) {
      const local = readLocal()
      const cloudEmpty = !cloudData || cloudData === DEFAULT_DATA || (
        !cloudData.apifyKeys?.length &&
        !cloudData.research?.sessions?.length &&
        (cloudData.research?.projects?.length || 0) <= 1 &&
        !cloudData.research?.projects?.[0]?.accounts?.length
      )
      const localHasContent = (
        local.apifyKeys?.length > 0 ||
        local.research?.sessions?.length > 0 ||
        local.research?.projects?.some(p => p.accounts?.length > 0)
      )
      if (cloudEmpty && localHasContent) {
        await writeCloud(local, userEmail)
        return local
      }
    }
    return cloudData
  }
  return readLocal()
}

export async function saveData(data, { cloud, userEmail } = {}) {
  if (cloud && supabaseEnabled) {
    await writeCloud(data, userEmail)
  }
  // Always also write locally as offline cache.
  writeLocal(data)
}

export function exportBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-ofm-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importBackup() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'application/json'
    inp.onchange = ev => {
      const f = ev.target.files[0]
      if (!f) return reject(new Error('No file'))
      const r = new FileReader()
      r.onload = () => {
        try { resolve(mergeDefaults(JSON.parse(r.result))) }
        catch (e) { reject(e) }
      }
      r.readAsText(f)
    }
    inp.click()
  })
}
