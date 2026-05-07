import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Video, Image as ImageIcon, Wand2, Play, Upload, ChevronDown, ChevronRight,
  Plus, Trash2, User, RefreshCw, Download, Sparkles, Eye, Filter
} from 'lucide-react'
import { useStore } from '../lib/store'

const ASPECT_OPTIONS = ['9:16', '4:5', '1:1', '16:9', '3:4', '4:3']
const VIDEO_RES_OPTIONS = ['480p', '720p', '1080p']

function proxy(url) { return url ? `/api/img?url=${encodeURIComponent(url)}` : '' }

function getReelMedia(item) {
  if (Array.isArray(item.childPosts) && item.childPosts.length > 0) return item.childPosts[0]?.displayUrl || ''
  return item.displayUrl || (Array.isArray(item.images) ? item.images[0] : '')
}
function getReelVideoUrl(item) {
  return item.videoUrl || item.video_url || ''
}
function engagementRatio(item) {
  const likes = item.likesCount || item.likes || 0
  const comments = item.commentsCount || item.comments || 0
  const views = item.videoViewCount || item.videoPlayCount || item.viewsCount || item.views || likes
  if (!views) return 0
  return ((likes + comments * 3) / views) * 100
}
function fmt(n) { if (!n) return '0'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n) }
function fmtTime(s) { if (s == null) return '–'; if (s < 60) return `${s}s`; return `${Math.floor(s/60)}m ${s%60}s` }

function FieldGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>{hint}</div>}
    </div>
  )
}

function Section({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text)' }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {Icon && <Icon size={14} style={{ color: 'var(--accent)' }} />}
        <span>{title}</span>
      </button>
      {open && <div style={{ padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border-soft)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginTop: -1 }}>{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ position: 'relative', display: 'inline-block', width: 36, height: 20 }}>
        <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: 10, background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s' }} />
        <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  )
}

function VideoSettings({ settings, onChange }) {
  return (
    <>
      <FieldGroup label={`Duration: ${settings.duration}s`}>
        <input type="range" min="1" max="15" value={settings.duration}
          onChange={e => onChange({ ...settings, duration: +e.target.value })}
          style={{ width: '100%' }} />
      </FieldGroup>
      <FieldGroup label="Resolution">
        <select className="inp inp-sm" value={settings.resolution}
          onChange={e => onChange({ ...settings, resolution: e.target.value })}>
          {VIDEO_RES_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </FieldGroup>
      <FieldGroup label="Aspect Ratio">
        <select className="inp inp-sm" value={settings.aspectRatio}
          onChange={e => onChange({ ...settings, aspectRatio: e.target.value })}>
          {ASPECT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </FieldGroup>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <Toggle label="Audio generieren" checked={settings.generateAudio}
          onChange={v => onChange({ ...settings, generateAudio: v })} />
        <Toggle label="Camera fixed" checked={settings.cameraFixed}
          onChange={v => onChange({ ...settings, cameraFixed: v })} />
      </div>
    </>
  )
}

export default function VideoCreation() {
  const { data, update, toast, loaded } = useStore()
  const activeTab = data.videoCreation?.activeTab || 'talkingHead'
  const setActiveTab = id => update(d => ({ ...d, videoCreation: { ...d.videoCreation, activeTab: id } }))

  if (!loaded) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-soft)' }}>
        {[
          { id: 'talkingHead', label: 'Talking Head', icon: User },
          { id: 'videoGen', label: 'Video Generation', icon: Sparkles }
        ].map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text2)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1
              }}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'talkingHead' && <TalkingHeadTab />}
      {activeTab === 'videoGen' && <VideoGenTab />}
    </div>
  )
}

/* ============================================================ TAB 1 — TALKING HEAD ============================================================ */
function TalkingHeadTab() {
  const { data, update, toast } = useStore()
  const fileInputRef = useRef(null)
  const [topicMode, setTopicMode] = useState('pool')
  const [customTopic, setCustomTopic] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [lastResult, setLastResult] = useState(null)

  const personas = data.videoCreation?.personas || []
  const activePersonaId = data.videoCreation?.activePersonaId || personas[0]?.id
  const persona = personas.find(p => p.id === activePersonaId) || personas[0]

  const wavespeedKey = data.serviceKeys?.wavespeed
  const anthropicKey = data.serviceKeys?.anthropic

  const settings = persona?.videoDefaults || { duration: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false, cameraFixed: false }
  const stylePrompt = persona?.imageDefaults?.stylePrompt || ''

  function updatePersona(patch) {
    update(d => ({
      ...d,
      videoCreation: {
        ...d.videoCreation,
        personas: d.videoCreation.personas.map(p => p.id === activePersonaId ? { ...p, ...patch } : p)
      }
    }))
  }
  function updateSettings(patch) { updatePersona({ videoDefaults: { ...persona.videoDefaults, ...patch } }) }
  function updateImageDefaults(patch) { updatePersona({ imageDefaults: { ...persona.imageDefaults, ...patch } }) }
  function setActivePersona(id) { update(d => ({ ...d, videoCreation: { ...d.videoCreation, activePersonaId: id } })) }
  function addPersona() {
    const name = prompt('Name der neuen Persona?')
    if (!name) return
    const id = 'p' + Date.now()
    const newP = { ...JSON.parse(JSON.stringify(personas[0] || {})), id, name, refImage: '', topicPool: [] }
    update(d => ({ ...d, videoCreation: { ...d.videoCreation, personas: [...d.videoCreation.personas, newP], activePersonaId: id } }))
  }
  function deletePersona() {
    if (personas.length <= 1) return toast('Mindestens 1 Persona muss bleiben', 'error')
    if (!confirm(`Persona "${persona.name}" wirklich löschen?`)) return
    update(d => ({
      ...d,
      videoCreation: {
        ...d.videoCreation,
        personas: d.videoCreation.personas.filter(p => p.id !== activePersonaId),
        activePersonaId: d.videoCreation.personas.find(p => p.id !== activePersonaId)?.id
      }
    }))
  }
  function onFileChosen(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast('Max 5MB für Reference-Bild', 'error')
    const reader = new FileReader()
    reader.onload = () => { updatePersona({ refImage: reader.result }); toast('Reference-Bild gespeichert', 'success') }
    reader.readAsDataURL(file)
  }
  function addTopicToPool() {
    const t = prompt('Neues Topic für ' + persona.name + ':')
    if (!t) return
    updatePersona({ topicPool: [...persona.topicPool, t] })
  }
  function removeTopicFromPool(t) {
    updatePersona({ topicPool: persona.topicPool.filter(x => x !== t) })
  }

  async function generate() {
    if (!wavespeedKey) return toast('WaveSpeed-Key fehlt (Settings)', 'error')
    if (!anthropicKey) return toast('Anthropic-Key fehlt (Settings)', 'error')
    let topic = ''
    if (topicMode === 'custom') topic = customTopic.trim()
    else if (topicMode === 'random') topic = persona.topicPool[Math.floor(Math.random() * persona.topicPool.length)]
    else topic = selectedTopic || persona.topicPool[0]
    if (!topic) return toast('Topic fehlt', 'error')

    setGenerating(true); setLastResult(null)
    try {
      setProgress('Claude generiert Prompts...')
      const scriptRes = await fetch('/api/anthropic/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, systemPrompt: persona.claudeSystemPrompt, topic })
      })
      const script = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(script.error || 'Script-Gen fehlgeschlagen')

      setProgress('Nano Banana Pro generiert Bild...')
      const imgRes = await fetch('/api/wavespeed/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wavespeedKey,
          prompt: [stylePrompt, script.imagePrompt].filter(Boolean).join('. '),
          refImage: persona.refImage || undefined,
          resolution: 2048, aspectRatio: settings.aspectRatio,
          format: 'jpeg', jpegQuality: 92, seed: 0, count: 1
        })
      })
      const imgJson = await imgRes.json()
      if (!imgRes.ok) throw new Error(imgJson.error || 'Image-Gen fehlgeschlagen')
      const imageUrl = imgJson.urls?.[0]
      if (!imageUrl) throw new Error('Keine Image-URL')

      setProgress('Seedance 2.0 generiert Video (1-2 Min)...')
      const vidStartRes = await fetch('/api/wavespeed/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wavespeedKey, imageUrl,
          prompt: script.imagePrompt,
          duration: settings.duration,
          resolution: settings.resolution,
          aspectRatio: settings.aspectRatio,
          direction: script.videoDirection || '',
          generateAudio: settings.generateAudio,
          cameraFixed: settings.cameraFixed
        })
      })
      const vidStart = await vidStartRes.json()
      if (!vidStartRes.ok) throw new Error(vidStart.error || 'Video-Submit fehlgeschlagen')

      let videoUrl = ''
      const deadline = Date.now() + 5 * 60 * 1000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000))
        const pollRes = await fetch('/api/wavespeed/poll', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wavespeedKey, taskId: vidStart.taskId })
        })
        const poll = await pollRes.json()
        if (poll.status === 'completed' && poll.urls?.[0]) { videoUrl = poll.urls[0]; break }
        if (poll.status === 'failed') throw new Error('Video-Gen fehlgeschlagen')
        setProgress(`Seedance 2.0: ${poll.status || 'processing'}...`)
      }
      if (!videoUrl) throw new Error('Video-Gen Timeout (>5 Min)')

      const result = {
        id: 'r' + Date.now(), at: new Date().toISOString(),
        kind: 'talkingHead',
        personaId: activePersonaId, personaName: persona.name,
        topic, imagePrompt: script.imagePrompt, videoDirection: script.videoDirection,
        imageUrl, videoUrl, settings: { ...settings }
      }
      update(d => ({ ...d, videoCreation: { ...d.videoCreation, runs: [result, ...(d.videoCreation.runs || [])].slice(0, 50) } }))
      setLastResult(result)
      toast('Generation fertig ✓', 'success')
    } catch (e) {
      toast('Fehler: ' + e.message, 'error')
    } finally {
      setGenerating(false); setProgress('')
    }
  }

  if (!persona) return <div className="muted">Keine Persona vorhanden.</div>
  const needsSetup = !wavespeedKey || !anthropicKey

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <User size={16} color="var(--text2)" />
        <span className="muted">Persona:</span>
        {personas.map(p => (
          <button key={p.id} onClick={() => setActivePersona(p.id)}
            className={p.id === activePersonaId ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}>{p.name}</button>
        ))}
        <button className="btn-icon" onClick={addPersona} title="Neue Persona"><Plus size={14} /></button>
        {personas.length > 1 && <button className="btn-icon" onClick={deletePersona} title="Persona löschen"><Trash2 size={14} /></button>}
      </div>

      {needsSetup && (
        <div className="card" style={{ borderColor: 'var(--orange)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Setup unvollständig</div>
          <div className="muted">Brauchst <a href="/settings">WaveSpeed-Key {!wavespeedKey ? '✗' : '✓'}</a> und <a href="/settings">Anthropic-Key {!anthropicKey ? '✗' : '✓'}</a> in Settings.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title">REFERENCE</div>
          <div onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFileChosen(e.dataTransfer.files[0]) }}
            style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)', marginBottom: 10 }}>
            <Upload size={20} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 12, fontWeight: 500 }}>Drag & drop oder klick</div>
            <div className="muted" style={{ fontSize: 11 }}>JPG/PNG/WebP · max 5MB</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => onFileChosen(e.target.files[0])} />
          {persona.refImage && (
            <div style={{ position: 'relative' }}>
              <img src={persona.refImage} alt="" style={{ width: '100%', borderRadius: 8 }} />
              <button className="btn-icon" onClick={() => updatePersona({ refImage: '' })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {!persona.refImage && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>kein Reference-Bild</div>}
        </div>

        <div className="card" style={{ borderLeft: '3px solid #a855f7' }}>
          <div className="card-title"><ImageIcon size={14} /> IMAGE PROMPT (Nano Banana)</div>
          <textarea className="inp" rows="8" placeholder="z.B. soft golden-hour lighting, Christian aesthetic, cozy bedroom..."
            value={stylePrompt}
            onChange={e => updateImageDefaults({ stylePrompt: e.target.value })} />
          <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
            Bleibt persistent. Wird mit dem Topic-spezifischen Prompt von Claude kombiniert.
          </div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="card-title"><Video size={14} /> VIDEO (Seedance 2.0)</div>
          <VideoSettings settings={settings} onChange={updateSettings} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">TOPIC</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[['pool', 'From pool'], ['custom', 'Custom'], ['random', 'Random']].map(([v, l]) => (
            <button key={v} onClick={() => setTopicMode(v)}
              className={topicMode === v ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}>{l}</button>
          ))}
        </div>
        {topicMode === 'pool' && (
          <select className="inp" value={selectedTopic || persona.topicPool[0] || ''}
            onChange={e => setSelectedTopic(e.target.value)}>
            {persona.topicPool.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {topicMode === 'custom' && (
          <textarea className="inp" rows="2" placeholder="Eigenes Topic..."
            value={customTopic} onChange={e => setCustomTopic(e.target.value)} />
        )}
        {topicMode === 'random' && (
          <div className="muted">Wird zufällig aus Pool gewählt ({persona.topicPool.length} Topics)</div>
        )}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="muted">Pool:</span>
          {persona.topicPool.map((t, i) => (
            <span key={i} className="pill" style={{ fontSize: 11 }}>
              {t.length > 50 ? t.slice(0, 50) + '…' : t}
              <button onClick={() => removeTopicFromPool(t)}>×</button>
            </span>
          ))}
          <button className="btn-icon" onClick={addTopicToPool} title="Topic hinzufügen"><Plus size={12} /></button>
        </div>
      </div>

      <Section title={`Persona · ${persona.name}'s voice (Claude system prompt)`} icon={User}>
        <textarea className="inp" rows="6"
          value={persona.claudeSystemPrompt}
          onChange={e => updatePersona({ claudeSystemPrompt: e.target.value })} />
      </Section>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 0' }}>
        <button className="btn" disabled={generating || needsSetup} onClick={generate}
          style={{ fontSize: 16, padding: '14px 40px' }}>
          {generating ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
          {generating ? 'Generiere...' : 'Generate Talking Head'}
        </button>
        {progress && <div className="muted">{progress}</div>}
      </div>

      <ResultPreview result={lastResult} />
      <PreviousRuns runs={data.videoCreation?.runs || []} />

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ============================================================ TAB 2 — VIDEO GENERATION (Reel Recreate) ============================================================ */
function VideoGenTab() {
  const { data, update, toast } = useStore()
  const fileInputRef = useRef(null)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState('')
  const [scrapeProgress, setScrapeProgress] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [lastResult, setLastResult] = useState(null)

  const vg = data.videoCreation?.videoGen || {}
  const reels = vg.reels || []
  const settings = vg.settings || { duration: 5, resolution: '720p', aspectRatio: '9:16', generateAudio: false, cameraFixed: false }

  const projects = data.research?.projects || []
  const activeProjectId = vg.activeProjectId || projects[0]?.id
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0]
  const projectAccounts = activeProject?.accounts || []

  const wavespeedKey = data.serviceKeys?.wavespeed
  const anthropicKey = data.serviceKeys?.anthropic
  const geminiKey = data.serviceKeys?.gemini
  const apifyKey = data.apifyKeys?.find(k => k.id === data.activeApifyKeyId)
  const apifyToken = apifyKey?.token

  function updateVG(patch) {
    update(d => ({ ...d, videoCreation: { ...d.videoCreation, videoGen: { ...d.videoCreation.videoGen, ...patch } } }))
  }
  function updateSettings(patch) { updateVG({ settings: { ...settings, ...patch } }) }

  function onFileChosen(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast('Max 5MB für Reference-Bild', 'error')
    const reader = new FileReader()
    reader.onload = () => { updateVG({ refImage: reader.result }); toast('Reference-Bild gespeichert', 'success') }
    reader.readAsDataURL(file)
  }

  async function runScrape() {
    if (!apifyToken) return toast('Apify-Key fehlt (Settings)', 'error')
    if (!projectAccounts.length) return toast('Projekt hat keine Accounts', 'error')
    const expectedTotal = projectAccounts.length * 30
    setScraping(true); setScrapeMsg(`Starte Apify-Run für "${activeProject.name}"...`)
    setScrapeProgress({ itemsScraped: 0, total: expectedTotal, runtimeSecs: 0, etaSecs: null })
    try {
      const startRes = await fetch('/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apifyToken, accounts: projectAccounts, type: 'reels', limit: 30 })
      })
      const startJson = await startRes.json()
      if (!startRes.ok) throw new Error(startJson.error || 'Start fehlgeschlagen')
      const { runId, datasetId } = startJson
      const pollDeadline = Date.now() + 15 * 60 * 1000
      let finalItems = null
      while (Date.now() < pollDeadline) {
        await new Promise(r => setTimeout(r, 5000))
        const pollRes = await fetch('/api/scrape-status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: apifyToken, runId, datasetId })
        })
        const pollJson = await pollRes.json()
        if (pollJson.status === 'SUCCEEDED') { finalItems = pollJson.items || []; break }
        if (pollJson.status && !['RUNNING', 'READY'].includes(pollJson.status)) {
          throw new Error(pollJson.error || `Status: ${pollJson.status}`)
        }
        const secs = pollJson.runtimeSecs || 0
        const items = pollJson.itemsScraped || 0
        let etaSecs = null
        if (items >= 5 && secs >= 5 && items < expectedTotal) {
          etaSecs = Math.max(0, Math.round((expectedTotal - items) / (items / secs)))
        }
        setScrapeProgress({ itemsScraped: items, total: expectedTotal, runtimeSecs: secs, etaSecs })
        setScrapeMsg('')
      }
      if (finalItems === null) throw new Error('Timeout (>15min)')
      updateVG({ reels: finalItems, lastScrapedAt: new Date().toISOString() })
      toast(`${finalItems.length} Reels gescrapt ✓`, 'success')
    } catch (e) {
      toast('Fehler: ' + e.message, 'error')
    } finally {
      setScraping(false); setScrapeMsg(''); setScrapeProgress(null)
    }
  }

  const filteredReels = useMemo(() => {
    return reels
      .map(i => ({ ...i, _ratio: engagementRatio(i) }))
      .sort((a, b) => vg.filter === 'viral'
        ? (b.videoViewCount || b.likesCount || 0) - (a.videoViewCount || a.likesCount || 0)
        : b._ratio - a._ratio)
  }, [reels, vg.filter])

  async function recreateReel(reel) {
    if (!vg.refImage) return toast('Kein Reference-Bild — bitte erst hochladen', 'error')
    if (!geminiKey) return toast('Gemini-Key fehlt (Settings)', 'error')
    if (!anthropicKey) return toast('Anthropic-Key fehlt (Settings)', 'error')
    if (!wavespeedKey) return toast('WaveSpeed-Key fehlt (Settings)', 'error')
    const videoUrl = getReelVideoUrl(reel)
    if (!videoUrl) return toast('Reel hat keine Video-URL — anderer Reel wählen', 'error')

    setGenerating(true); setLastResult(null)
    try {
      setProgress('Gemini schaut sich das Reel an (~30s)...')
      const aRes = await fetch('/api/gemini/analyze-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey, videoUrl, prompt: vg.geminiPrompt })
      })
      // Handle non-JSON error responses (e.g. Vercel timeout returns plain text)
      const aText = await aRes.text()
      let aJson
      try { aJson = JSON.parse(aText) }
      catch { throw new Error(`Gemini-Endpoint Fehler (${aRes.status}): ${aText.slice(0, 200)}`) }
      if (!aRes.ok) throw new Error(aJson.error || 'Analyse fehlgeschlagen')
      const analysis = aJson.analysis

      setProgress('Claude schreibt Seedance-Prompt...')
      const cRes = await fetch('/api/anthropic/video-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, analysis, metaPrompt: vg.claudeMetaPrompt })
      })
      const cJson = await cRes.json()
      if (!cRes.ok) throw new Error(cJson.error || 'Prompt-Gen fehlgeschlagen')
      const seedancePrompt = cJson.prompt

      setProgress('Seedance 2.0 generiert Video (1-2 Min)...')
      const vRes = await fetch('/api/wavespeed/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wavespeedKey,
          imageUrl: vg.refImage,
          prompt: seedancePrompt,
          duration: settings.duration,
          resolution: settings.resolution,
          aspectRatio: settings.aspectRatio,
          generateAudio: settings.generateAudio,
          cameraFixed: settings.cameraFixed
        })
      })
      const vStart = await vRes.json()
      if (!vRes.ok) throw new Error(vStart.error || 'Video-Submit fehlgeschlagen')

      let outVideoUrl = ''
      const deadline = Date.now() + 5 * 60 * 1000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000))
        const pollRes = await fetch('/api/wavespeed/poll', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wavespeedKey, taskId: vStart.taskId })
        })
        const poll = await pollRes.json()
        if (poll.status === 'completed' && poll.urls?.[0]) { outVideoUrl = poll.urls[0]; break }
        if (poll.status === 'failed') throw new Error('Video-Gen fehlgeschlagen')
        setProgress(`Seedance 2.0: ${poll.status || 'processing'}...`)
      }
      if (!outVideoUrl) throw new Error('Video-Gen Timeout')

      const result = {
        id: 'r' + Date.now(), at: new Date().toISOString(),
        kind: 'videoGen',
        sourceReelUrl: reel.url || `https://instagram.com/p/${reel.shortCode}`,
        sourceAccount: reel.ownerUsername || reel.username,
        analysis, prompt: seedancePrompt,
        imageUrl: vg.refImage,
        videoUrl: outVideoUrl,
        settings: { ...settings }
      }
      update(d => ({ ...d, videoCreation: { ...d.videoCreation, runs: [result, ...(d.videoCreation.runs || [])].slice(0, 50) } }))
      setLastResult(result)
      toast('Recreate fertig ✓', 'success')
    } catch (e) {
      toast('Fehler: ' + e.message, 'error')
    } finally {
      setGenerating(false); setProgress('')
    }
  }

  const needsSetup = !wavespeedKey || !anthropicKey || !geminiKey || !apifyToken

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {needsSetup && (
        <div className="card" style={{ borderColor: 'var(--orange)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Setup unvollständig</div>
          <div className="muted">
            Brauchst <a href="/settings">Apify {!apifyToken ? '✗' : '✓'}</a> · WaveSpeed {!wavespeedKey ? '✗' : '✓'} · Anthropic {!anthropicKey ? '✗' : '✓'} · Gemini {!geminiKey ? '✗' : '✓'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title">REFERENCE BILD</div>
          <div onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFileChosen(e.dataTransfer.files[0]) }}
            style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)', marginBottom: 10 }}>
            <Upload size={20} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 12, fontWeight: 500 }}>Drag & drop oder klick</div>
            <div className="muted" style={{ fontSize: 11 }}>JPG/PNG/WebP · max 5MB · wird bei jedem Recreate genutzt</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => onFileChosen(e.target.files[0])} />
          {vg.refImage && (
            <div style={{ position: 'relative' }}>
              <img src={vg.refImage} alt="" style={{ width: '100%', borderRadius: 8 }} />
              <button className="btn-icon" onClick={() => updateVG({ refImage: '' })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {!vg.refImage && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>kein Reference-Bild</div>}
        </div>

        <div className="card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="card-title"><Video size={14} /> VIDEO SETTINGS (Seedance 2.0)</div>
          <VideoSettings settings={settings} onChange={updateSettings} />
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase' }}>Projekt</span>
          <select className="inp inp-sm" style={{ minWidth: 180 }}
            value={activeProjectId || ''}
            onChange={e => updateVG({ activeProjectId: e.target.value })}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.accounts.length})</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>{projectAccounts.length} Account{projectAccounts.length === 1 ? '' : 's'}</span>
          <a href="/content-research" style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>Projekte verwalten →</a>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={runScrape} disabled={scraping || !projectAccounts.length || !apifyToken}>
            <RefreshCw size={14} className={scraping ? 'spin' : ''} />
            {scraping ? 'Scraping...' : 'Reels scrapen'}
          </button>
          {reels.length > 0 && (
            <>
              <span className="muted">{reels.length} Reels geladen</span>
              {vg.lastScrapedAt && <span className="muted" style={{ fontSize: 11 }}>· {new Date(vg.lastScrapedAt).toLocaleString('de-DE')}</span>}
            </>
          )}
        </div>
        {scrapeMsg && <div className="muted" style={{ marginTop: 10 }}>{scrapeMsg}</div>}
        {scrapeProgress && (() => {
          const { itemsScraped, total, runtimeSecs, etaSecs } = scrapeProgress
          const pct = total > 0 ? Math.min(100, Math.round((itemsScraped / total) * 100)) : 0
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--text2)' }}>{itemsScraped} / {total} Reels</span>
                <span style={{ display: 'flex', gap: 14, color: 'var(--text2)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pct}%</span>
                  <span>⏱ {fmtTime(runtimeSecs)}</span>
                  <span>ETA: {etaSecs != null ? fmtTime(etaSecs) : '...'}</span>
                </span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', transition: 'width 0.4s' }} />
              </div>
            </div>
          )
        })()}
      </div>

      {reels.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={14} color="var(--text2)" />
            <button className={vg.filter === 'viral' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => updateVG({ filter: 'viral' })}>Most Viral</button>
            <button className={vg.filter === 'converting' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => updateVG({ filter: 'converting' })}>Highest Converting</button>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{filteredReels.length} Reels</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {filteredReels.map((reel, i) => {
              const id = reel.id || reel.shortCode || reel.url || i
              const thumb = getReelMedia(reel)
              const v = reel.videoViewCount || reel.videoPlayCount || 0
              const l = reel.likesCount || 0
              const hasVideo = !!getReelVideoUrl(reel)
              return (
                <div key={id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {thumb && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', background: 'var(--bg3)' }}>
                      <img src={proxy(thumb)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                        {reel._ratio?.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{reel.ownerUsername || reel.username}</div>
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 8, color: 'var(--text2)' }}>
                      <span>👁 {fmt(v)}</span><span>♥ {fmt(l)}</span>
                    </div>
                    <button className="btn btn-sm" disabled={generating || !hasVideo || !vg.refImage}
                      onClick={() => recreateReel(reel)}
                      style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                      title={!hasVideo ? 'Reel hat keine Video-URL' : !vg.refImage ? 'Reference-Bild fehlt' : ''}>
                      <Sparkles size={12} /> Recreate
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Section title="🤖 Gemini-Prompt (wie soll das Video analysiert werden?)" icon={Eye}>
        <textarea className="inp" rows="5" value={vg.geminiPrompt}
          onChange={e => updateVG({ geminiPrompt: e.target.value })} />
      </Section>

      <Section title="✍️ Claude-Prompt (wie soll der Seedance-Prompt geschrieben werden?)" icon={Wand2}>
        <textarea className="inp" rows="5" value={vg.claudeMetaPrompt}
          onChange={e => updateVG({ claudeMetaPrompt: e.target.value })} />
      </Section>

      {generating && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={16} className="spin" style={{ color: 'var(--accent)' }} />
            <span>{progress}</span>
          </div>
        </div>
      )}

      <ResultPreview result={lastResult} />
      <PreviousRuns runs={data.videoCreation?.runs || []} />

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ============================================================ SHARED ============================================================ */
function ResultPreview({ result }) {
  if (!result) return null
  return (
    <div className="card">
      <div className="card-title">Latest Run</div>
      {result.topic && <div className="muted" style={{ marginBottom: 8 }}><strong>Topic:</strong> {result.topic}</div>}
      {result.sourceReelUrl && <div className="muted" style={{ marginBottom: 8 }}><strong>Source:</strong> <a href={result.sourceReelUrl} target="_blank" rel="noreferrer">@{result.sourceAccount}</a></div>}
      {result.prompt && <div className="muted" style={{ marginBottom: 8 }}><strong>Seedance-Prompt:</strong> {result.prompt}</div>}
      {result.imagePrompt && <div className="muted" style={{ marginBottom: 8 }}><strong>Image-Prompt:</strong> {result.imagePrompt}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {result.imageUrl && (
          <div>
            <img src={result.imageUrl} alt="" style={{ width: '100%', borderRadius: 8 }} />
            <a href={result.imageUrl} target="_blank" rel="noreferrer" download className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}>
              <Download size={12} /> Image
            </a>
          </div>
        )}
        {result.videoUrl && (
          <div>
            <video src={result.videoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
            <a href={result.videoUrl} target="_blank" rel="noreferrer" download className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}>
              <Download size={12} /> Video
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviousRuns({ runs }) {
  return (
    <Section title={`Previous runs (${runs.length})`}>
      {!runs.length && <div className="muted">Noch keine Runs</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {runs.map(r => (
          <div key={r.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 8, fontSize: 11 }}>
            {r.imageUrl && <img src={r.imageUrl} alt="" style={{ width: '100%', borderRadius: 4, aspectRatio: '9/16', objectFit: 'cover' }} />}
            <div style={{ marginTop: 6, fontWeight: 500 }}>
              {r.kind === 'videoGen' ? '🎬 Recreate' : '🗣 Talking Head'}
              {r.personaName && ` · ${r.personaName}`}
            </div>
            <div className="muted">{(r.topic || r.prompt || '').slice(0, 50)}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{new Date(r.at).toLocaleString('de-DE')}</div>
            {r.videoUrl && <a href={r.videoUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}><Video size={11} /> Video</a>}
          </div>
        ))}
      </div>
    </Section>
  )
}
