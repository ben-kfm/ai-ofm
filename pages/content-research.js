import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Play, Plus, X, Star, ClipboardList, ExternalLink,
  ChevronLeft, ChevronRight, Trash2
} from 'lucide-react'
import { useStore } from '../lib/store'

// Proxy Instagram CDN images through our own API to bypass hotlink protection
function proxy(url) {
  if (!url) return ''
  return `/api/img?url=${encodeURIComponent(url)}`
}

// Extract all media URLs from a post (single image, sidecar/carousel, or reel)
function getMedia(item) {
  // Sidecar/carousel: childPosts[].displayUrl
  if (Array.isArray(item.childPosts) && item.childPosts.length > 0) {
    return item.childPosts.map(c => c.displayUrl).filter(Boolean)
  }
  // Some Apify variants return images[] array
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter(Boolean)
  }
  // Single image / reel
  return [item.displayUrl].filter(Boolean)
}

function engagementRatio(item) {
  const likes = item.likesCount || item.likes || 0
  const comments = item.commentsCount || item.comments || 0
  const views = item.videoViewCount || item.videoPlayCount || item.viewsCount || item.views || likes
  if (!views) return 0
  return ((likes + comments * 3) / views) * 100
}
function ratioClass(r) { if (r > 3) return 'eng-high'; if (r >= 1) return 'eng-mid'; return 'eng-low' }
function fmt(n) { if (!n) return '0'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n) }

const TABS = [
  { id: 'research', label: 'Research' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'sessions', label: 'Sessions' }
]

export default function ContentResearch() {
  const { data, updateResearch, update, toast, loaded } = useStore()
  const [tab, setTab] = useState('research')
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState('')
  const [scrapeProgress, setScrapeProgress] = useState(null) // { itemsScraped, total, runtimeSecs, etaSecs }
  const [results, setResults] = useState([])
  const [accountInput, setAccountInput] = useState('')
  const [modalItem, setModalItem] = useState(null)
  const [modalIdx, setModalIdx] = useState(0)

  const r = data.research
  const projects = r.projects || []
  const activeProject = projects.find(p => p.id === r.activeProjectId) || projects[0]
  const projectAccounts = activeProject?.accounts || []
  const activeKey = data.apifyKeys.find(k => k.id === data.activeApifyKeyId) || null
  const activeToken = activeKey?.token || ''

  // Project management
  function setActiveProject(id) {
    updateResearch({ activeProjectId: id })
  }
  function updateActiveProject(patch) {
    updateResearch({
      projects: projects.map(p => p.id === activeProject.id ? { ...p, ...patch } : p)
    })
  }
  function addProject() {
    const name = prompt('Name des neuen Projekts?')?.trim()
    if (!name) return
    if (projects.some(p => p.name === name)) return toast('Projekt-Name existiert schon', 'error')
    const id = 'p' + Date.now()
    updateResearch({
      projects: [...projects, { id, name, accounts: [] }],
      activeProjectId: id
    })
    toast(`Projekt "${name}" erstellt`, 'success')
  }
  function renameProject() {
    const name = prompt('Neuer Name für "' + activeProject.name + '"?', activeProject.name)?.trim()
    if (!name || name === activeProject.name) return
    updateActiveProject({ name })
  }
  function deleteProject() {
    if (projects.length <= 1) return toast('Mindestens 1 Projekt muss bleiben', 'error')
    if (!confirm(`Projekt "${activeProject.name}" mit ${projectAccounts.length} Account${projectAccounts.length === 1 ? '' : 's'} wirklich löschen?`)) return
    const remaining = projects.filter(p => p.id !== activeProject.id)
    updateResearch({
      projects: remaining,
      activeProjectId: remaining[0].id
    })
    toast('Projekt gelöscht', 'success')
  }

  // Reset modal index when item changes
  useEffect(() => { setModalIdx(0) }, [modalItem])

  // Keyboard navigation in modal (left/right arrows, escape)
  useEffect(() => {
    if (!modalItem) return
    const media = getMedia(modalItem)
    const onKey = e => {
      if (e.key === 'Escape') setModalItem(null)
      else if (e.key === 'ArrowLeft' && media.length > 1) setModalIdx(i => (i - 1 + media.length) % media.length)
      else if (e.key === 'ArrowRight' && media.length > 1) setModalIdx(i => (i + 1) % media.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalItem])

  async function runScrape() {
    if (!activeToken) return toast('Kein aktiver Apify-Key — in Settings einrichten', 'error')
    if (!projectAccounts.length) return toast('Projekt hat keine Accounts — füg welche hinzu', 'error')
    const expectedTotal = projectAccounts.length * (r.limit || 30)
    setScraping(true)
    setScrapeMsg(`Starte Apify-Run für "${activeProject.name}"...`)
    setScrapeProgress({ itemsScraped: 0, total: expectedTotal, runtimeSecs: 0, etaSecs: null })
    setResults([])
    try {
      // 1. Start the Actor run (~5s)
      const startRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          accounts: projectAccounts,
          type: r.scraperType,
          limit: r.limit
        })
      })
      const startJson = await startRes.json()
      if (!startRes.ok) throw new Error(startJson.error || 'Start fehlgeschlagen')
      const { runId, datasetId } = startJson

      // 2. Poll until done (no time limit — each request takes ~3s, runs every 5s)
      const pollDeadline = Date.now() + 15 * 60 * 1000 // safety cap: 15min
      let finalItems = null
      while (Date.now() < pollDeadline) {
        await new Promise(r => setTimeout(r, 5000))
        const pollRes = await fetch('/api/scrape-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: activeToken, runId, datasetId, daysBack: r.daysBack })
        })
        const pollJson = await pollRes.json()
        if (pollJson.status === 'SUCCEEDED') {
          finalItems = pollJson.items || []
          break
        }
        if (pollJson.status && !['RUNNING', 'READY'].includes(pollJson.status)) {
          throw new Error(pollJson.error || `Status: ${pollJson.status}`)
        }
        const secs = pollJson.runtimeSecs || 0
        const items = pollJson.itemsScraped || 0
        // ETA: assume current rate continues. Need at least 5s + 5 items for stable estimate.
        let etaSecs = null
        if (items >= 5 && secs >= 5 && items < expectedTotal) {
          const rate = items / secs
          etaSecs = Math.max(0, Math.round((expectedTotal - items) / rate))
        }
        setScrapeProgress({ itemsScraped: items, total: expectedTotal, runtimeSecs: secs, etaSecs })
        setScrapeMsg('')
      }
      if (finalItems === null) throw new Error('Timeout (>15min)')

      setResults(finalItems)
      const sess = {
        id: Date.now(),
        at: new Date().toISOString(),
        type: r.scraperType,
        accounts: [...projectAccounts],
        count: finalItems.length,
        keyLabel: activeKey.label,
        projectName: activeProject.name,
        items: finalItems
      }
      updateResearch({ sessions: [sess, ...(r.sessions || [])].slice(0, 30) })
      toast(`${finalItems.length} Posts gescrapt ✓`, 'success')
    } catch (e) {
      toast('Fehler: ' + e.message, 'error')
    } finally {
      setScraping(false); setScrapeMsg(''); setScrapeProgress(null)
    }
  }

  function fmtTime(s) {
    if (s == null) return '–'
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}m ${r}s`
  }

  function addAccount() {
    const a = accountInput.trim().replace('@', '')
    if (!a) return
    if (projectAccounts.includes(a)) return toast('Account schon im Projekt', 'error')
    updateActiveProject({ accounts: [...projectAccounts, a] })
    setAccountInput('')
  }
  const removeAccount = a => updateActiveProject({ accounts: projectAccounts.filter(x => x !== a) })

  function toggleFav(item) {
    const id = item.id || item.shortCode || item.url
    const isFav = r.favorites.includes(id)
    updateResearch({ favorites: isFav ? r.favorites.filter(x => x !== id) : [...r.favorites, id] })
  }
  function addToKanban(item) {
    const id = item.id || item.shortCode || item.url
    const all = [...r.kanban.backlog, ...r.kanban.inprogress, ...r.kanban.done]
    if (all.find(x => x.id === id)) return toast('Schon im Kanban', 'error')
    const card = {
      id,
      url: item.url || `https://instagram.com/p/${item.shortCode}`,
      caption: (item.caption || '').slice(0, 140),
      likes: item.likesCount || 0,
      views: item.videoViewCount || item.videoPlayCount || 0,
      account: item.ownerUsername || item.username || '?',
      thumb: getMedia(item)[0] || '',
      addedAt: Date.now()
    }
    updateResearch({ kanban: { ...r.kanban, backlog: [card, ...r.kanban.backlog] } })
    toast('Zu Kanban hinzugefügt ✓', 'success')
  }
  function moveCard(id, fromCol, toCol) {
    const card = r.kanban[fromCol].find(c => c.id === id); if (!card) return
    updateResearch({
      kanban: {
        ...r.kanban,
        [fromCol]: r.kanban[fromCol].filter(c => c.id !== id),
        [toCol]: [card, ...r.kanban[toCol]]
      }
    })
  }
  const deleteCard = (id, col) => updateResearch({ kanban: { ...r.kanban, [col]: r.kanban[col].filter(c => c.id !== id) } })

  const filtered = useMemo(() => {
    return results
      .map(i => ({ ...i, _ratio: engagementRatio(i) }))
      .sort((a, b) => r.filter === 'viral'
        ? (b.videoViewCount || b.likesCount || 0) - (a.videoViewCount || a.likesCount || 0)
        : b._ratio - a._ratio
      )
  }, [results, r.filter])

  function exportVA() {
    const lines = [`# AI OFM Export — ${new Date().toLocaleString('de-DE')}`, '', `## ${r.filter === 'viral' ? 'Most Viral' : 'Highest Converting'}`, '']
    filtered.forEach((it, i) => {
      const url = it.url || `https://instagram.com/p/${it.shortCode}`
      const account = it.ownerUsername || it.username || '?'
      const v = it.videoViewCount || it.videoPlayCount || 0
      const l = it.likesCount || 0
      const date = it.timestamp ? new Date(it.timestamp).toLocaleDateString('de-DE') : '?'
      lines.push(`${i + 1}. ${url}`)
      lines.push(`   Account: @${account} | Views: ${fmt(v)} | Likes: ${fmt(l)} | Datum: ${date}`)
      lines.push('')
    })
    navigator.clipboard.writeText(lines.join('\n')).then(() => toast('In Zwischenablage kopiert ✓', 'success'))
  }

  if (!loaded) return null

  // Modal data
  const modalMedia = modalItem ? getMedia(modalItem) : []
  const modalCurrent = modalMedia[modalIdx] || ''
  const isCarousel = modalMedia.length > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-soft)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              color: tab === t.id ? 'var(--text)' : 'var(--text2)',
              fontWeight: tab === t.id ? 600 : 400,
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* RESEARCH TAB */}
      {tab === 'research' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!activeToken && (
            <div className="card" style={{ borderColor: 'var(--orange)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Kein aktiver Apify-Key</div>
              <div className="muted">Geh in <Link href="/settings">Settings</Link> und lege mindestens einen Apify-Key an.</div>
            </div>
          )}

          {/* Project selector */}
          <div className="card" style={{ background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Projekt</span>
              <select
                className="inp inp-sm" style={{ minWidth: 180 }}
                value={activeProject?.id || ''}
                onChange={e => setActiveProject(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.accounts.length})</option>
                ))}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={addProject} title="Neues Projekt"><Plus size={14} /> Neu</button>
              <button className="btn btn-ghost btn-sm" onClick={renameProject} title="Umbenennen">Umbenennen</button>
              <button className="btn btn-ghost btn-sm" onClick={deleteProject} title="Projekt löschen" disabled={projects.length <= 1}>
                <Trash2 size={14} />
              </button>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{projectAccounts.length} Account{projectAccounts.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <input
                className="inp" style={{ flex: '1 1 220px', maxWidth: 320 }}
                placeholder={`@account zu "${activeProject?.name || 'Projekt'}" hinzufügen`}
                value={accountInput}
                onChange={e => setAccountInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAccount()}
              />
              <button className="btn btn-ghost btn-sm" onClick={addAccount}><Plus size={14} /> Account</button>
              <select className="inp inp-sm" style={{ width: 'auto' }} value={r.scraperType} onChange={e => updateResearch({ scraperType: e.target.value })}>
                <option value="posts">Posts</option>
                <option value="reels">Reels</option>
              </select>
              <input type="number" className="inp inp-sm" style={{ width: 80 }} value={r.daysBack} onChange={e => updateResearch({ daysBack: +e.target.value })} title="Tage zurück" />
              <input type="number" className="inp inp-sm" style={{ width: 80 }} value={r.limit} onChange={e => updateResearch({ limit: +e.target.value })} title="Limit pro Account" />
              <button className="btn" disabled={scraping || !activeToken || !projectAccounts.length} onClick={runScrape}>
                <Play size={14} /> {scraping ? 'Scraping...' : `Scrape "${activeProject?.name || ''}"`}
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {projectAccounts.map(a => (
                <span key={a} className="pill">@{a} <button onClick={() => removeAccount(a)}>×</button></span>
              ))}
              {!projectAccounts.length && <span className="muted">Keine Accounts in "{activeProject?.name}" — füg welche hinzu</span>}
            </div>

            {scrapeMsg && <div className="muted" style={{ marginTop: 10 }}>{scrapeMsg}</div>}

            {scrapeProgress && (
              (() => {
                const { itemsScraped, total, runtimeSecs, etaSecs } = scrapeProgress
                const pct = total > 0 ? Math.min(100, Math.round((itemsScraped / total) * 100)) : 0
                return (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>{itemsScraped} / {total} Posts</span>
                      <span style={{ display: 'flex', gap: 14, color: 'var(--text2)' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pct}%</span>
                        <span title="Bereits gelaufen">⏱ {fmtTime(runtimeSecs)}</span>
                        <span title="Geschätzte Restzeit">ETA: {etaSecs != null ? fmtTime(etaSecs) : '...'}</span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg3, rgba(255,255,255,0.08))', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: pct + '%',
                        background: 'var(--accent)',
                        transition: 'width 0.4s ease',
                        backgroundImage: 'linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))'
                      }} />
                    </div>
                  </div>
                )
              })()
            )}
          </div>

          {/* Filter row */}
          {results.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className={r.filter === 'viral' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => updateResearch({ filter: 'viral' })}>Most Viral</button>
              <button className={r.filter === 'converting' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => updateResearch({ filter: 'converting' })}>Highest Converting</button>
              <span className="muted" style={{ marginLeft: 'auto' }}>{filtered.length} Posts</span>
              <button className="btn btn-ghost btn-sm" onClick={exportVA}><ClipboardList size={14} /> Export VA</button>
            </div>
          )}

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {filtered.map((it, i) => {
              const id = it.id || it.shortCode || it.url
              const isFav = r.favorites.includes(id)
              const v = it.videoViewCount || it.videoPlayCount || 0
              const l = it.likesCount || 0
              const media = getMedia(it)
              const thumb = media[0]
              const isMulti = media.length > 1
              return (
                <div key={id || i} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={() => setModalItem(it)}>
                  {thumb && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'var(--bg3)' }}>
                      <img src={proxy(thumb)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      {isMulti && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                          ⊞ {media.length}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>@{it.ownerUsername || it.username}</span>
                      <span className={ratioClass(it._ratio)}>{it._ratio.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 8, color: 'var(--text2)' }}>
                      <span>👁 {fmt(v)}</span><span>♥ {fmt(l)}</span>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); toggleFav(it) }} style={{ flex: 1, justifyContent: 'center' }}>
                        <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      <button className="btn btn-sm" onClick={e => { e.stopPropagation(); addToKanban(it) }} style={{ flex: 1, justifyContent: 'center' }}>
                        <Plus size={12} /> Kanban
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!results.length && !scraping && (
              <div className="muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60 }}>
                Noch keine Ergebnisse — füge Accounts hinzu und drück Scrape.
              </div>
            )}
          </div>
        </div>
      )}

      {/* KANBAN TAB */}
      {tab === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {[['backlog', '📥 Backlog'], ['inprogress', '🚧 In Progress'], ['done', '✅ Done']].map(([col, label]) => (
            <div key={col} className="kanban-col">
              <h3 style={{ fontSize: 13, marginBottom: 12, color: 'var(--text2)' }}>{label} <span style={{ color: 'var(--text3)' }}>({r.kanban[col].length})</span></h3>
              {r.kanban[col].map(c => (
                <div key={c.id} className="kanban-card">
                  {c.thumb && <img src={proxy(c.thumb)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} loading="lazy" />}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>@{c.account}</div>
                  <div style={{ fontSize: 12 }}>{c.caption || '(keine Caption)'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>👁 {fmt(c.views)} ♥ {fmt(c.likes)}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}><ExternalLink size={12} /></a>
                    {col !== 'backlog' && <button className="btn btn-ghost btn-sm" onClick={() => moveCard(c.id, col, col === 'inprogress' ? 'backlog' : 'inprogress')}><ChevronLeft size={12} /></button>}
                    {col !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => moveCard(c.id, col, col === 'backlog' ? 'inprogress' : 'done')}><ChevronRight size={12} /></button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteCard(c.id, col)}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
              {!r.kanban[col].length && <div className="muted" style={{ textAlign: 'center', padding: 24 }}>leer</div>}
            </div>
          ))}
        </div>
      )}

      {/* SESSIONS TAB */}
      {tab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.sessions.map(s => {
            const hasItems = Array.isArray(s.items) && s.items.length > 0
            return (
              <div
                key={s.id}
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, cursor: hasItems ? 'pointer' : 'default', opacity: hasItems ? 1 : 0.6 }}
                onClick={() => {
                  if (!hasItems) return toast('Diese Session hat keine gespeicherten Posts (alt)', 'error')
                  setResults(s.items)
                  setTab('research')
                  toast(`${s.items.length} Posts geladen`, 'success')
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {new Date(s.at).toLocaleString('de-DE')}
                    {hasItems && <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--accent-soft, rgba(124,77,255,0.15))', color: 'var(--accent)', borderRadius: 4 }}>klickbar</span>}
                  </div>
                  <div className="muted" style={{ marginTop: 2 }}>{s.projectName ? `${s.projectName} • ` : ''}{s.type} • {s.accounts.length} Accounts • {s.count} Posts{s.keyLabel ? ` • Key: ${s.keyLabel}` : ''}</div>
                </div>
                <div className="muted" style={{ marginRight: 8 }}>{s.accounts.slice(0, 3).map(a => '@' + a).join(', ')}{s.accounts.length > 3 ? '...' : ''}</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => {
                    e.stopPropagation()
                    if (!confirm('Session löschen?')) return
                    updateResearch({ sessions: r.sessions.filter(x => x.id !== s.id) })
                  }}
                  title="Session löschen"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
          {!r.sessions.length && <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Noch keine Sessions</div>}
        </div>
      )}

      {/* MODAL with carousel navigation */}
      {modalItem && (
        <div className="modal-back" onClick={() => setModalItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            {modalCurrent && (
              <div style={{ position: 'relative', background: '#000', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
                <img src={proxy(modalCurrent)} style={{ width: '100%', display: 'block', maxHeight: '70vh', objectFit: 'contain' }} alt="" />
                {isCarousel && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); setModalIdx(i => (i - 1 + modalMedia.length) % modalMedia.length) }}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      aria-label="Vorheriges Bild"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setModalIdx(i => (i + 1) % modalMedia.length) }}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      aria-label="Nächstes Bild"
                    >
                      <ChevronRight size={22} />
                    </button>
                    <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                      {modalMedia.map((_, i) => (
                        <button
                          key={i}
                          onClick={e => { e.stopPropagation(); setModalIdx(i) }}
                          style={{
                            width: i === modalIdx ? 22 : 8, height: 8, borderRadius: 4,
                            background: i === modalIdx ? 'white' : 'rgba(255,255,255,0.5)',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          aria-label={`Bild ${i + 1}`}
                        />
                      ))}
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 12, padding: '4px 10px', borderRadius: 12 }}>
                      {modalIdx + 1} / {modalMedia.length}
                    </div>
                  </>
                )}
              </div>
            )}
            <div style={{ padding: 16 }}>
              <div className="muted" style={{ fontSize: 13 }}>@{modalItem.ownerUsername || modalItem.username}</div>
              <div style={{ fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {modalItem.caption || '(keine Caption)'}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={modalItem.url || `https://instagram.com/p/${modalItem.shortCode}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  <ExternalLink size={12} /> Auf Instagram
                </a>
                <button className="btn btn-sm" onClick={() => { addToKanban(modalItem); setModalItem(null) }}>
                  <Plus size={12} /> Kanban
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setModalItem(null)} style={{ marginLeft: 'auto' }}>Schließen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
