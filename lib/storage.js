// Centralized localStorage wrapper for AI OFM
// All app state in one key, versioned, with migrations.

const STORAGE_KEY = 'ai_ofm_data_v1'
const LEGACY_KEYS = ['argus2_data_v2', 'argus2_data_v1']

export const DEFAULT_DATA = {
  // Theme
  theme: 'dark',

  // API Keys
  apifyKeys: [],            // [{ id, label, token }]
  activeApifyKeyId: null,
  serviceKeys: {
    higgsfield: '',
    wavespeed: '',
    seedance: '',
    anthropic: '',
    openai: '',
    falai: ''
  },

  // Content Research (Argus)
  research: {
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

export function loadData() {
  if (typeof window === 'undefined') return DEFAULT_DATA
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return mergeDefaults(parsed)
    }
    // Migrate from legacy Argus storage
    for (const legacyKey of LEGACY_KEYS) {
      const legacy = localStorage.getItem(legacyKey)
      if (legacy) {
        const old = JSON.parse(legacy)
        const migrated = migrateFromLegacy(old)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
  } catch (e) {
    console.error('Storage load error', e)
  }
  return DEFAULT_DATA
}

function mergeDefaults(parsed) {
  return {
    ...DEFAULT_DATA,
    ...parsed,
    serviceKeys: { ...DEFAULT_DATA.serviceKeys, ...(parsed.serviceKeys || {}) },
    research: {
      ...DEFAULT_DATA.research,
      ...(parsed.research || {}),
      kanban: { ...DEFAULT_DATA.research.kanban, ...(parsed.research?.kanban || {}) }
    }
  }
}

function migrateFromLegacy(old) {
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA))
  data.theme = old.theme || 'dark'
  // V1 had single token, V2 has apifyKeys
  if (old.apifyToken) {
    const id = 'k' + Date.now()
    data.apifyKeys = [{ id, label: 'Account 1', token: old.apifyToken }]
    data.activeApifyKeyId = id
  } else if (Array.isArray(old.apifyKeys)) {
    data.apifyKeys = old.apifyKeys
    data.activeApifyKeyId = old.activeApifyKeyId || (old.apifyKeys[0]?.id ?? null)
  }
  if (old.serviceKeys) data.serviceKeys = { ...data.serviceKeys, ...old.serviceKeys }
  // Move research-related keys
  data.research.accounts = old.accounts || []
  data.research.sessions = old.sessions || []
  data.research.kanban = old.kanban || data.research.kanban
  data.research.favorites = old.favorites || []
  data.research.filter = old.filter || 'viral'
  data.research.scraperType = old.scraperType || 'posts'
  data.research.daysBack = old.daysBack ?? 14
  data.research.limit = old.limit ?? 30
  return data
}

export function saveData(d) {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch {}
  }
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
