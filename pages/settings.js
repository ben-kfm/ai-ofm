import { useState } from 'react'
import { Plus, Trash2, Download, Upload, Key, Shield, Database, Info } from 'lucide-react'
import { useStore } from '../lib/store'
import { exportBackup, importBackup, DEFAULT_DATA } from '../lib/storage'

const SERVICES = [
  { id: 'wavespeed', label: 'WaveSpeed (Nano Banana Pro + Seedance 2.0)', placeholder: 'ws_...', helpUrl: 'https://wavespeed.ai' },
  { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com' },
  { id: 'gemini', label: 'Google Gemini (Video-Analyse)', placeholder: 'AIza...', helpUrl: 'https://aistudio.google.com/apikey' },
  { id: 'higgsfield', label: 'Higgsfield Soul 2', placeholder: 'hf_...', helpUrl: 'https://higgsfield.ai' },
  { id: 'seedance', label: 'Seedance / ByteDance Video', placeholder: '...', helpUrl: 'https://replicate.com/bytedance/seedance-1-pro' },
  { id: 'falai', label: 'fal.ai', placeholder: 'fal_...', helpUrl: 'https://fal.ai' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys' }
]

function maskKey(k) { if (!k) return ''; if (k.length < 12) return '••••'; return k.slice(0, 8) + '…' + k.slice(-4) }

export default function Settings() {
  const { data, update, setData, toast, loaded } = useStore()
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyToken, setNewKeyToken] = useState('')

  function addApifyKey() {
    const label = newKeyLabel.trim()
    const token = newKeyToken.trim()
    if (!label || !token) return toast('Label und Token sind Pflicht', 'error')
    if (data.apifyKeys.some(k => k.label === label)) return toast('Label existiert bereits', 'error')
    if (data.apifyKeys.some(k => k.token === token)) return toast('Token existiert bereits', 'error')
    const id = 'k' + Date.now()
    update({
      apifyKeys: [...data.apifyKeys, { id, label, token }],
      activeApifyKeyId: data.activeApifyKeyId || id
    })
    setNewKeyLabel(''); setNewKeyToken('')
    toast(`Key "${label}" hinzugefügt`, 'success')
  }
  function deleteApifyKey(id) {
    if (!confirm('Diesen Key wirklich löschen?')) return
    const remaining = data.apifyKeys.filter(k => k.id !== id)
    update({
      apifyKeys: remaining,
      activeApifyKeyId: data.activeApifyKeyId === id ? (remaining[0]?.id || null) : data.activeApifyKeyId
    })
  }
  function setServiceKey(id, value) {
    update({ serviceKeys: { ...data.serviceKeys, [id]: value } })
  }

  if (!loaded) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>

      {/* APIFY MULTI-KEY */}
      <div className="card">
        <div className="card-title"><Key size={16} /> Apify API Keys</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          Mehrere Accounts speichern. Aktiver Key wird beim Scrapen verwendet — oben rechts oder hier umschalten.
        </div>

        {data.apifyKeys.length === 0 && (
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 16, textAlign: 'center', marginBottom: 12 }}>
            <div className="muted">Noch keine Keys angelegt</div>
          </div>
        )}

        {data.apifyKeys.map(k => {
          const isActive = data.activeApifyKeyId === k.id
          return (
            <div key={k.id} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              marginBottom: 8, padding: '12px 14px',
              background: 'var(--bg3)', borderRadius: 10,
              border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-soft)'
            }}>
              <input
                type="radio"
                checked={isActive}
                onChange={() => update({ activeApifyKeyId: k.id })}
                style={{ width: 16, height: 16 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {k.label}
                  {isActive && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8 }}>● aktiv</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 2 }}>
                  {maskKey(k.token)}
                </div>
              </div>
              <button className="btn-icon" onClick={() => deleteApifyKey(k.id)} title="Löschen">
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}

        <div style={{ marginTop: 14, padding: 14, background: 'var(--bg3)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>+ Neuen Key anlegen</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              className="inp inp-sm" style={{ flex: '1 1 140px', minWidth: 120 }}
              placeholder="Label (z.B. Account 1)"
              value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)}
            />
            <input
              className="inp inp-sm" type="password" style={{ flex: '2 1 220px', minWidth: 200 }}
              placeholder="apify_api_..."
              value={newKeyToken} onChange={e => setNewKeyToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addApifyKey()}
            />
            <button className="btn btn-sm" onClick={addApifyKey}><Plus size={12} /> Hinzufügen</button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Token bekommst du unter <a href="https://console.apify.com/account/integrations" target="_blank" rel="noreferrer">apify.com</a>
          </div>
        </div>
      </div>

      {/* OTHER SERVICE KEYS */}
      <div className="card">
        <div className="card-title"><Shield size={16} /> Service API Keys</div>
        <div className="muted" style={{ marginBottom: 14 }}>
          Für die Automations Video Creation (Seedance/Kling) und Carousels (Higgsfield/WaveSpeed). Werden lokal im Browser gespeichert.
        </div>
        {SERVICES.map(s => (
          <div key={s.id} style={{ marginBottom: 12 }}>
            <label className="label">
              {s.label}
              {' '}<a href={s.helpUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>↗</a>
            </label>
            <input
              type="password"
              className="inp"
              value={data.serviceKeys[s.id] || ''}
              onChange={e => setServiceKey(s.id, e.target.value)}
              placeholder={s.placeholder}
            />
          </div>
        ))}
      </div>

      {/* DATA */}
      <div className="card">
        <div className="card-title"><Database size={16} /> Daten</div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Alle Daten (Keys, Accounts, Kanban, Sessions) liegen in deinem Browser. Backup machen wenn du auf einen anderen Browser/PC wechseln willst.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportBackup(data)}>
            <Download size={14} /> Backup exportieren
          </button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            try {
              const imported = await importBackup()
              setData(imported)
              toast('Backup importiert ✓', 'success')
            } catch (e) {
              toast('Import fehlgeschlagen: ' + (e.message || 'unbekannt'), 'error')
            }
          }}>
            <Upload size={14} /> Backup importieren
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (!confirm('Wirklich ALLE Daten löschen? (Keys, Accounts, Kanban, Sessions)')) return
            setData(DEFAULT_DATA)
            toast('Alle Daten gelöscht', 'success')
          }}>
            <Trash2 size={14} /> Alles zurücksetzen
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="card" style={{ borderColor: 'var(--accent-soft)', background: 'var(--accent-soft)' }}>
        <div className="card-title"><Info size={16} /> Apify Free-Tier Hinweis</div>
        <div className="muted" style={{ lineHeight: 1.6 }}>
          Instagram-Scraping benötigt Residential-Proxies. Free-Tier-Apify-Accounts haben oft nur Datacenter-Proxies — dann liefert ein Run 0 Posts (Instagram blockt). Multi-Key-Switching hilft nicht. Lösung: Apify Starter (~$49/Monat) auf einem Account, der hat ~9 GB Residential pro Monat.
        </div>
      </div>

      {/* APP INFO */}
      <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
        AI OFM v0.1 • Built for BOSS
      </div>
    </div>
  )
}
