import { useState, useEffect, useRef } from 'react'
import {
  Video, Image as ImageIcon, Wand2, Play, Upload, Settings as SettingsIcon,
  ChevronDown, ChevronRight, Plus, Trash2, User, Save, RefreshCw, Download
} from 'lucide-react'
import { useStore } from '../lib/store'

const RESOLUTION_OPTIONS = [
  { value: 1024, label: '1K (1024)' },
  { value: 2048, label: '2K (2048)' },
  { value: 4096, label: '4K (4096)' }
]
const ASPECT_OPTIONS = ['9:16', '4:5', '1:1', '16:9', '3:4', '4:3']
const VIDEO_RES_OPTIONS = ['480p', '720p', '1080p']
const FPS_OPTIONS = [24, 30, 60]

function Section({ title, icon: Icon, children, defaultOpen = false, color }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'var(--bg2)',
          border: '1px solid var(--border-soft)', borderRadius: 10,
          fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text)'
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {Icon && <Icon size={14} style={{ color: color || 'var(--accent)' }} />}
        <span>{title}</span>
      </button>
      {open && <div style={{ padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border-soft)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginTop: -1 }}>{children}</div>}
    </div>
  )
}

function FieldGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="label">{label}</label>
      {children}
      {hint && <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>{hint}</div>}
    </div>
  )
}

export default function VideoCreation() {
  const { data, update, toast, loaded } = useStore()
  const fileInputRef = useRef(null)

  const [topicMode, setTopicMode] = useState('pool') // pool / custom / random
  const [customTopic, setCustomTopic] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [lastResult, setLastResult] = useState(null) // { imagePrompt, videoDirection, imageUrl, videoUrl }

  // Persona management
  const personas = data.videoCreation?.personas || []
  const activePersonaId = data.videoCreation?.activePersonaId || personas[0]?.id
  const persona = personas.find(p => p.id === activePersonaId) || personas[0]

  // Live settings (start from persona defaults, user can edit)
  const [imgSettings, setImgSettings] = useState(persona?.imageDefaults || {})
  const [vidSettings, setVidSettings] = useState(persona?.videoDefaults || {})

  // Reset settings when persona changes
  useEffect(() => {
    if (persona) {
      setImgSettings(persona.imageDefaults)
      setVidSettings(persona.videoDefaults)
    }
  }, [activePersonaId])

  const wavespeedKey = data.serviceKeys?.wavespeed
  const anthropicKey = data.serviceKeys?.anthropic

  function updatePersona(patch) {
    update(d => ({
      ...d,
      videoCreation: {
        ...d.videoCreation,
        personas: d.videoCreation.personas.map(p =>
          p.id === activePersonaId ? { ...p, ...patch } : p
        )
      }
    }))
  }
  function setActivePersona(id) {
    update(d => ({ ...d, videoCreation: { ...d.videoCreation, activePersonaId: id } }))
  }
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
    reader.onload = () => {
      updatePersona({ refImage: reader.result })
      toast('Reference-Bild gespeichert', 'success')
    }
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

    setGenerating(true)
    setLastResult(null)
    try {
      // 1. Claude → image prompt + video direction
      setProgress('Claude generiert Prompt...')
      const scriptRes = await fetch('/api/anthropic/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, systemPrompt: persona.claudeSystemPrompt, topic })
      })
      const script = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(script.error || 'Script-Gen fehlgeschlagen')

      // 2. WaveSpeed Nano Banana Pro → image
      setProgress('Nano Banana Pro generiert Bild...')
      const imgRes = await fetch('/api/wavespeed/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wavespeedKey,
          prompt: [imgSettings.stylePrompt, script.imagePrompt].filter(Boolean).join('. '),
          refImage: persona.refImage || undefined,
          resolution: imgSettings.resolution,
          aspectRatio: imgSettings.aspectRatio,
          format: imgSettings.format,
          jpegQuality: imgSettings.jpegQuality,
          seed: imgSettings.seed,
          count: imgSettings.count
        })
      })
      const imgJson = await imgRes.json()
      if (!imgRes.ok) throw new Error(imgJson.error || 'Image-Gen fehlgeschlagen')
      const imageUrl = imgJson.urls?.[0]
      if (!imageUrl) throw new Error('Keine Image-URL')

      // 3. WaveSpeed Seedance 2.0 → video
      setProgress('Seedance 2.0 generiert Video (kann 1-2 Min dauern)...')
      const vidStartRes = await fetch('/api/wavespeed/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wavespeedKey,
          imageUrl,
          prompt: script.imagePrompt,
          duration: vidSettings.duration,
          resolution: vidSettings.resolution,
          aspectRatio: vidSettings.aspectRatio,
          frameRate: vidSettings.frameRate,
          direction: [vidSettings.direction, script.videoDirection].filter(Boolean).join('. '),
          negativePrompt: vidSettings.negativePrompt
        })
      })
      const vidStart = await vidStartRes.json()
      if (!vidStartRes.ok) throw new Error(vidStart.error || 'Video-Submit fehlgeschlagen')

      // Poll for video
      let videoUrl = ''
      const deadline = Date.now() + 5 * 60 * 1000 // 5 min max
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000))
        const pollRes = await fetch('/api/wavespeed/poll', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wavespeedKey, taskId: vidStart.taskId })
        })
        const poll = await pollRes.json()
        if (poll.status === 'completed' && poll.urls?.[0]) {
          videoUrl = poll.urls[0]; break
        }
        if (poll.status === 'failed') throw new Error('Video-Gen fehlgeschlagen')
        setProgress(`Seedance 2.0: ${poll.status || 'processing'}...`)
      }
      if (!videoUrl) throw new Error('Video-Gen Timeout (>5 Min)')

      const result = {
        id: 'r' + Date.now(),
        at: new Date().toISOString(),
        personaId: activePersonaId,
        personaName: persona.name,
        topic,
        imagePrompt: script.imagePrompt,
        videoDirection: script.videoDirection,
        imageUrl, videoUrl,
        imageSettings: { ...imgSettings },
        videoSettings: { ...vidSettings }
      }
      update(d => ({
        ...d,
        videoCreation: { ...d.videoCreation, runs: [result, ...(d.videoCreation.runs || [])].slice(0, 50) }
      }))
      setLastResult(result)
      toast('Generation fertig ✓', 'success')
    } catch (e) {
      toast('Fehler: ' + e.message, 'error')
    } finally {
      setGenerating(false); setProgress('')
    }
  }

  if (!loaded) return null
  if (!persona) return <div className="muted">Keine Persona vorhanden — wird nach erstem Load erstellt.</div>

  const needsSetup = !wavespeedKey || !anthropicKey

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Persona Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <User size={16} color="var(--text2)" />
        <span className="muted">Persona:</span>
        {personas.map(p => (
          <button key={p.id} onClick={() => setActivePersona(p.id)}
            className={p.id === activePersonaId ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}>
            {p.name}
          </button>
        ))}
        <button className="btn-icon" onClick={addPersona} title="Neue Persona"><Plus size={14} /></button>
        {personas.length > 1 && (
          <button className="btn-icon" onClick={deletePersona} title="Persona löschen"><Trash2 size={14} /></button>
        )}
      </div>

      {needsSetup && (
        <div className="card" style={{ borderColor: 'var(--orange)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Setup unvollständig</div>
          <div className="muted">
            Brauchst <a href="/settings">WaveSpeed-Key {!wavespeedKey ? '✗' : '✓'}</a> und <a href="/settings">Anthropic-Key {!anthropicKey ? '✗' : '✓'}</a> in Settings.
          </div>
        </div>
      )}

      {/* 3-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>

        {/* REFERENCE */}
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title">REFERENCE</div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFileChosen(e.dataTransfer.files[0]) }}
            style={{
              border: '2px dashed var(--border)', borderRadius: 10,
              padding: 14, textAlign: 'center', cursor: 'pointer',
              background: 'var(--bg3)', marginBottom: 10
            }}
          >
            <Upload size={20} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 12, fontWeight: 500 }}>Drag & drop oder klick</div>
            <div className="muted" style={{ fontSize: 11 }}>JPG/PNG/WebP · max 5MB</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => onFileChosen(e.target.files[0])} />

          {persona.refImage && (
            <div style={{ position: 'relative' }}>
              <img src={persona.refImage} alt="Reference" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
              <button className="btn-icon" onClick={() => updatePersona({ refImage: '' })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {!persona.refImage && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>kein Reference-Bild</div>}

          <FieldGroup label="Reference-URL (alternativ zu Upload)" hint="Wird benutzt wenn kein Upload da ist">
            <input className="inp inp-sm" placeholder="https://..."
              value={persona.refImage?.startsWith('http') ? persona.refImage : ''}
              onChange={e => updatePersona({ refImage: e.target.value })} />
          </FieldGroup>
        </div>

        {/* IMAGE · NANO BANANA PRO */}
        <div className="card" style={{ borderLeft: '3px solid var(--accent2)' }}>
          <div className="card-title"><ImageIcon size={14} /> IMAGE · Nano Banana Pro</div>

          <FieldGroup label="Resolution">
            <select className="inp inp-sm" value={imgSettings.resolution}
              onChange={e => setImgSettings({ ...imgSettings, resolution: +e.target.value })}>
              {RESOLUTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldGroup>

          <FieldGroup label="Aspect Ratio">
            <select className="inp inp-sm" value={imgSettings.aspectRatio}
              onChange={e => setImgSettings({ ...imgSettings, aspectRatio: e.target.value })}>
              {ASPECT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </FieldGroup>

          <FieldGroup label="Output format">
            <select className="inp inp-sm" value={imgSettings.format}
              onChange={e => setImgSettings({ ...imgSettings, format: e.target.value })}>
              <option value="jpeg">jpeg</option>
              <option value="png">png</option>
              <option value="webp">webp</option>
            </select>
          </FieldGroup>

          {imgSettings.format === 'jpeg' && (
            <FieldGroup label={`JPEG quality: ${imgSettings.jpegQuality}`}>
              <input type="range" min="1" max="100" value={imgSettings.jpegQuality}
                onChange={e => setImgSettings({ ...imgSettings, jpegQuality: +e.target.value })}
                style={{ width: '100%' }} />
            </FieldGroup>
          )}

          <FieldGroup label="Seed (0 = random)">
            <input type="number" className="inp inp-sm" value={imgSettings.seed}
              onChange={e => setImgSettings({ ...imgSettings, seed: +e.target.value })} />
          </FieldGroup>

          <FieldGroup label="Anzahl Bilder pro Run">
            <input type="number" min="1" max="4" className="inp inp-sm" value={imgSettings.count}
              onChange={e => setImgSettings({ ...imgSettings, count: +e.target.value })} />
          </FieldGroup>

          <Section title="Image style prompt" icon={Wand2}>
            <textarea className="inp" rows="3" placeholder="z.B. soft golden-hour lighting, Christian aesthetic..."
              value={imgSettings.stylePrompt}
              onChange={e => setImgSettings({ ...imgSettings, stylePrompt: e.target.value })} />
          </Section>
        </div>

        {/* VIDEO · SEEDANCE 2.0 */}
        <div className="card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div className="card-title"><Video size={14} /> VIDEO · Seedance 2.0</div>

          <FieldGroup label={`Duration: ${vidSettings.duration}s`}>
            <input type="range" min="1" max="15" value={vidSettings.duration}
              onChange={e => setVidSettings({ ...vidSettings, duration: +e.target.value })}
              style={{ width: '100%' }} />
          </FieldGroup>

          <FieldGroup label="Resolution">
            <select className="inp inp-sm" value={vidSettings.resolution}
              onChange={e => setVidSettings({ ...vidSettings, resolution: e.target.value })}>
              {VIDEO_RES_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FieldGroup>

          <FieldGroup label="Aspect Ratio">
            <select className="inp inp-sm" value={vidSettings.aspectRatio}
              onChange={e => setVidSettings({ ...vidSettings, aspectRatio: e.target.value })}>
              {ASPECT_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </FieldGroup>

          <FieldGroup label="Frame rate (FPS)">
            <select className="inp inp-sm" value={vidSettings.frameRate}
              onChange={e => setVidSettings({ ...vidSettings, frameRate: +e.target.value })}>
              {FPS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </FieldGroup>

          <FieldGroup label="Batch (Videos pro Run)">
            <input type="number" min="1" max="5" className="inp inp-sm" value={vidSettings.batch}
              onChange={e => setVidSettings({ ...vidSettings, batch: +e.target.value })} />
          </FieldGroup>

          <Section title="Video direction (anti-zoom etc.)" icon={Wand2}>
            <textarea className="inp" rows="2" placeholder="z.B. anti-zoom, slow push-in, idle breathing..."
              value={vidSettings.direction}
              onChange={e => setVidSettings({ ...vidSettings, direction: e.target.value })} />
          </Section>

          <Section title="Negative prompt (optional)">
            <textarea className="inp" rows="2" placeholder="z.B. distorted face, extra limbs..."
              value={vidSettings.negativePrompt}
              onChange={e => setVidSettings({ ...vidSettings, negativePrompt: e.target.value })} />
          </Section>
        </div>
      </div>

      {/* TOPIC */}
      <div className="card">
        <div className="card-title">TOPIC</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[['pool', 'From pool'], ['custom', 'Custom'], ['random', 'Random per video']].map(([v, l]) => (
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
          <div className="muted">Wird zufällig aus dem Pool von "{persona.name}" gewählt ({persona.topicPool.length} Topics)</div>
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

      {/* PERSONA — Claude system prompt */}
      <Section title={`Persona · ${persona.name}'s voice (Claude system prompt)`} icon={User}>
        <textarea className="inp" rows="6"
          value={persona.claudeSystemPrompt}
          onChange={e => updatePersona({ claudeSystemPrompt: e.target.value })} />
        <div className="muted" style={{ marginTop: 6 }}>
          Wird als <code>system</code>-Prompt an Claude geschickt — bestimmt Stimme, Stil, Werte der Persona.
        </div>
      </Section>

      {/* GENERATE */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 0' }}>
        <button className="btn" disabled={generating || needsSetup} onClick={generate}
          style={{ fontSize: 16, padding: '14px 40px' }}>
          {generating ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
          {generating ? 'Generiere...' : 'Generate'}
        </button>
        <div className="muted" style={{ fontSize: 11 }}>
          {vidSettings.batch} × ({vidSettings.duration}s · {vidSettings.resolution} · {vidSettings.aspectRatio}) + {imgSettings.count} × Nano Banana Pro {imgSettings.resolution >= 4096 ? '4K' : imgSettings.resolution >= 2048 ? '2K' : '1K'}
        </div>
        {progress && <div className="muted">{progress}</div>}
      </div>

      {/* LAST RESULT preview */}
      {lastResult && (
        <div className="card">
          <div className="card-title">Latest Run</div>
          <div className="muted" style={{ marginBottom: 8 }}><strong>Topic:</strong> {lastResult.topic}</div>
          <div className="muted" style={{ marginBottom: 8 }}><strong>Image-Prompt:</strong> {lastResult.imagePrompt}</div>
          <div className="muted" style={{ marginBottom: 12 }}><strong>Video-Direction:</strong> {lastResult.videoDirection}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {lastResult.imageUrl && (
              <div>
                <img src={lastResult.imageUrl} alt="" style={{ width: '100%', borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <a href={lastResult.imageUrl} target="_blank" rel="noreferrer" download className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <Download size={12} /> Image
                  </a>
                </div>
              </div>
            )}
            {lastResult.videoUrl && (
              <div>
                <video src={lastResult.videoUrl} controls style={{ width: '100%', borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <a href={lastResult.videoUrl} target="_blank" rel="noreferrer" download className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <Download size={12} /> Video
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PREVIOUS RUNS */}
      <Section title={`Previous runs (${data.videoCreation?.runs?.length || 0})`}>
        {!data.videoCreation?.runs?.length && <div className="muted">Noch keine Runs</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {(data.videoCreation?.runs || []).map(r => (
            <div key={r.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 8, fontSize: 11 }}>
              {r.imageUrl && <img src={r.imageUrl} alt="" style={{ width: '100%', borderRadius: 4, aspectRatio: '9/16', objectFit: 'cover' }} />}
              <div style={{ marginTop: 6, fontWeight: 500 }}>{r.personaName}</div>
              <div className="muted">{r.topic.slice(0, 50)}{r.topic.length > 50 ? '…' : ''}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{new Date(r.at).toLocaleString('de-DE')}</div>
              {r.videoUrl && <a href={r.videoUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}><Video size={11} /> Video</a>}
            </div>
          ))}
        </div>
      </Section>

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
