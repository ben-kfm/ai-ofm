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
    falai: '',
    gemini: ''                   // Google AI Studio API Key — für Video-Analyse
  },

  // Drive Service Account JSON (paste full JSON)
  driveServiceAccount: '',
  driveFolders: {
    images: '',                  // Drive folder ID for images
    videos: ''                   // Drive folder ID for videos
  },

  // Content Research (Argus)
  research: {
    projects: [
      { id: 'default', name: 'Default', accounts: [] }
    ],
    activeProjectId: 'default',
    accounts: [],                // legacy — migrated into projects[0] on load
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
    activeTab: 'talkingHead',    // 'talkingHead' | 'videoGen'
    personas: [DEFAULT_PERSONA],
    activePersonaId: 'lilly',
    runs: [],                    // last 50 generated runs
    // Video Generation — Reel-Recreate pipeline
    // Pipeline: select reel from scraped session → Gemini analyzes → Claude writes prompt → Seedance image-to-video with refImage
    videoGen: {
      refImage: '',              // user-uploaded reference image (persistent)
      activeProjectId: null,     // re-uses research.projects (shared with Content Research)
      reels: [],                 // last scraped reels for video gen (separate from Content Research sessions)
      lastScrapedAt: null,
      filter: 'viral',           // viral | converting
      geminiPrompt: 'Analyze this short-form vertical video in extreme detail. Describe everything visible: the subject\'s appearance, expression and how it evolves, their position and posture, the setting and lighting, the camera movement (zoom, pan, static, push-in), what action happens frame-by-frame, the mood and pacing, any props, text overlays, transitions or effects. Be specific and visual — this analysis will be used to recreate the same video with a different person.',
      claudeMetaPrompt: 'You are a creative director for short-form 9:16 video. Given an analysis of a viral reel, write a single concise prompt (50-90 words) for Seedance 2.0 image-to-video to recreate the same vibe and motion. Focus on: camera movement, expression evolution, subtle action, mood. The first frame is provided as reference image — describe motion only, not appearance. Output ONLY the prompt, no preamble, no quotes.',
      settings: {
        duration: 5,
        resolution: '720p',
        aspectRatio: '9:16',
        generateAudio: false,
        cameraFixed: false
      }
    },
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
  // Migrate research.accounts → research.projects[0] if no projects yet
  const existingResearch = parsed.research || {}
  let projects = existingResearch.projects
  let activeProjectId = existingResearch.activeProjectId
  if (!Array.isArray(projects) || !projects.length) {
    projects = [{ id: 'default', name: 'Default', accounts: existingResearch.accounts || [] }]
    activeProjectId = 'default'
  }
  return {
    ...DEFAULT_DATA,
    ...parsed,
    serviceKeys: { ...DEFAULT_DATA.serviceKeys, ...(parsed.serviceKeys || {}) },
    driveFolders: { ...DEFAULT_DATA.driveFolders, ...(parsed.driveFolders || {}) },
    research: {
      ...DEFAULT_DATA.research,
      ...existingResearch,
      projects,
      activeProjectId,
      kanban: { ...DEFAULT_DATA.research.kanban, ...(existingResearch.kanban || {}) }
    },
    videoCreation: {
      ...DEFAULT_DATA.videoCreation,
      ...(parsed.videoCreation || {}),
      personas: parsed.videoCreation?.personas?.length
        ? parsed.videoCreation.personas
        : DEFAULT_DATA.videoCreation.personas,
      videoGen: {
        ...DEFAULT_DATA.videoCreation.videoGen,
        ...(parsed.videoCreation?.videoGen || {}),
        settings: {
          ...DEFAULT_DATA.videoCreation.videoGen.settings,
          ...(parsed.videoCreation?.videoGen?.settings || {})
        }
      },
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
