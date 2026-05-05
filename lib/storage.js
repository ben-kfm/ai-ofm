// Centralized localStorage wrapper for AI OFM
// All app state in one key, versioned, with migrations.

const STORAGE_KEY = 'ai_ofm_data_v3'
const LEGACY_KEYS = ['ai_ofm_data_v2', 'ai_ofm_data_v1', 'argus2_data_v2', 'argus2_data_v1']

const DEFAULT_PERSONA = {
  id: 'lilly',
  name: 'Lilly',
  refImage: '',                // data: URL or remote URL
  claudeSystemPrompt: 'You are Lilly, a 22-year-old Christian Good Girl from Texas. Soft-spoken, gentle, slightly playful. You speak in short personal anecdotes that hint at your faith and traditional values. Always first-person, present tense.',
  topicPool: [
    'the Christian boy who tried to neg me at coffee hour',
    'why I stopped going to the bar with my friends',
    'what my grandma told me about being a wife',
    'the verse that changed how I see dating'
  ],
  imageDefaults: {
    resolution: 2048,            // 1024 / 2048 / 4096
    aspectRatio: '9:16',
    format: 'jpeg',
    jpegQuality: 92,
    seed: 0,
    stylePrompt: '',
    count: 1
  },
  videoDefaults: {
    duration: 11,                // seconds
    resolution: '720p',          // 480p / 720p / 1080p
    aspectRatio: '9:16',
    frameRate: 24,               // 24 / 30 / 60
    batch: 1,
    direction: '',               // anti-zoom etc.
    negativePrompt: ''
  }
}

export const DEFAULT_DATA = {
  // Theme
  theme: 'dark',

  // API Keys
  apifyKeys: [],
  activeApifyKeyId: null,
  serviceKeys: {
    higgsfield: '',
    wavespeed: '',
    seedance: '',
    anthropic: '',
    openai: '',
    falai: ''
  },

  // Drive Service Account JSON (paste full JSON)
  driveServiceAccount: '',
  driveFolders: {
    images: '',                  // Drive folder ID for images
    videos: ''                   // Drive folder ID for videos
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
  },

  // Video Creation (Lilly Pipeline)
  videoCreation: {
    personas: [DEFAULT_PERSONA],
    activePersonaId: 'lilly',
    runs: [],                    // last 50 generated runs
    advanced: {
      maxRetries: 3,
      pollInterval: 4000
    }
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
    driveFolders: { ...DEFAULT_DATA.driveFolders, ...(parsed.driveFolders || {}) },
    research: {
      ...DEFAULT_DATA.research,
      ...(parsed.research || {}),
      kanban: { ...DEFAULT_DATA.research.kanban, ...(parsed.research?.kanban || {}) }
    },
    videoCreation: {
      ...DEFAULT_DATA.videoCreation,
      ...(parsed.videoCreation || {}),
      personas: parsed.videoCreation?.personas?.length
        ? parsed.videoCreation.personas
        : DEFAULT_DATA.videoCreation.personas,
      advanced: { ...DEFAULT_DATA.videoCreation.advanced, ...(parsed.videoCreation?.advanced || {}) }
    }
  }
}

function migrateFromLegacy(old) {
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA))
  data.theme = old.theme || 'dark'
  if (old.apifyToken) {
    const id = 'k' + Date.now()
    data.apifyKeys = [{ id, label: 'Account 1', token: old.apifyToken }]
    data.activeApifyKeyId = id
  } else if (Array.isArray(old.apifyKeys)) {
    data.apifyKeys = old.apifyKeys
    data.activeApifyKeyId = old.activeApifyKeyId || (old.apifyKeys[0]?.id ?? null)
  }
  if (old.serviceKeys) data.serviceKeys = { ...data.serviceKeys, ...old.serviceKeys }
  if (old.research) {
    data.research = { ...data.research, ...old.research }
  } else {
    data.research.accounts = old.accounts || []
    data.research.sessions = old.sessions || []
    data.research.kanban = old.kanban || data.research.kanban
    data.research.favorites = old.favorites || []
    data.research.filter = old.filter || 'viral'
    data.research.scraperType = old.scraperType || 'posts'
    data.research.daysBack = old.daysBack ?? 14
    data.research.limit = old.limit ?? 30
  }
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
