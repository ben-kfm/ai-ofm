import { useEffect, useState } from 'react'
import { Plus, Trash2, Download, Upload, Key, Database, Info, UserPlus, Shield, Mail } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { exportBackup, importBackup, DEFAULT_DATA } from '../lib/storage'
import { getSupabase, supabaseEnabled } from '../lib/supabase'

function maskKey(k) { if (!k) return ''; if (k.length < 12) return '••••'; return k.slice(0, 8) + '…' + k.slice(-4) }

export default function Settings() {
  const { data, update, setData, toast, loaded } = useStore()
  const { user, isAdmin } = useAuth()
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyToken, setNewKeyToken] = useState('')

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [allowed, setAllowed] = useState([])
  const [allowedLoading, setAllowedLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin || !supabaseEnabled) return
    loadAllowed()
  }, [isAdmin])

  async function loadAllowed() {
    setAllowedLoading(true)
    try {
      const sb = getSupabase()
      const { data, error } = await sb.from('allowed_users').select('email, is_admin, invited_at, invited_by').order('invited_at', { ascending: false })
      if (error) throw error
      setAllowed(data || [])
    } catch (e) {
      toast('Liste laden fehlgeschlagen: ' + e.message, 'error')
    } finally {
      setAllowedLoading(false)
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return toast('Gültige E-Mail eintragen', 'error')
    if (allowed.some(a => a.email === email)) return toast('Schon eingeladen', 'error')
    setInviting(true)
    try {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler')
      toast(`${email} eingeladen ✓ Magic-Link wurde verschickt.`, 'success')
      setInviteEmail('')
      loadAllowed()
    } catch (e) {
      toast('Invite fehlgeschlagen: ' + e.message, 'error')
    } finally {
      setInviting(false)
    }
  }

  async function revokeAccess(email) {
    if (email === user.email) return toast('Du kannst dich nicht selbst entfernen', 'error')
    if (!confirm(`Zugriff für ${email} entfernen?`)) return
    try {
      const sb = getSupabase()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch('/api/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler')
      toast(`${email} entfernt`, 'success')
      loadAllowed()
    } catch (e) {
      toast('Entfernen fehlgeschlagen: ' + e.message, 'error')
    }
  }

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

  if (!loaded) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>

      {/* INVITES (Admin only) */}
      {isAdmin && supabaseEnabled && (
        <div className="card">
          <div className="card-title"><UserPlus size={16} /> Team-Zugriff</div>
          <div className="muted" style={{ marginBottom: 14 }}>
            Lade Leute per E-Mail ein. Sie bekommen einen Magic-Link und können sich danach selbst einloggen.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text3)' }} />
              <input
                className="inp inp-sm" style={{ paddingLeft: 34 }}
                type="email"
                placeholder="mail@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
              />
            </div>
            <button className="btn btn-sm" onClick={sendInvite} disabled={inviting}>
              <UserPlus size={12} /> {inviting ? 'Sende…' : 'Einladen'}
            </button>
          </div>

          {allowedLoading ? (
            <div className="muted">Lade Mitglieder…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allowed.map(a => (
                <div key={a.email} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'var(--bg3)', borderRadius: 10,
                  border: '1px solid var(--border-soft)'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {a.email}
                      {a.is_admin && <span style={{ color: 'var(--accent3)', fontSize: 10, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.08, fontWeight: 700 }}>● Admin</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      Eingeladen am {a.invited_at ? new Date(a.invited_at).toLocaleDateString('de-DE') : '?'}
                      {a.invited_by ? ` von ${a.invited_by}` : ''}
                    </div>
                  </div>
                  {!a.is_admin && (
                    <button className="btn-icon" onClick={() => revokeAccess(a.email)} title="Zugriff entziehen">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {!allowed.length && <div className="muted">Noch niemand eingeladen.</div>}
            </div>
          )}
        </div>
      )}

      {!supabaseEnabled && (
        <div className="card" style={{ borderColor: 'var(--orange)' }}>
          <div className="card-title" style={{ color: 'var(--orange)' }}><Shield size={16} /> Auth nicht konfiguriert</div>
          <div className="muted">
            Setze in Vercel die ENV-Variablen <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> und <code>SUPABASE_SERVICE_ROLE_KEY</code>. Solange das fehlt, läuft die App im lokalen Single-User-Modus weiter.
          </div>
        </div>
      )}

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
                  {isActive && <span style={{ color: 'var(--accent3)', fontSize: 11, marginLeft: 8 }}>● aktiv</span>}
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

      {/* DATA */}
      <div className="card">
        <div className="card-title"><Database size={16} /> Daten</div>
        <div className="muted" style={{ marginBottom: 12 }}>
          {supabaseEnabled
            ? 'Daten liegen in der Cloud (Supabase) und werden zwischen allen eingeloggten Usern geteilt. Backup ist optional.'
            : 'Daten liegen in deinem Browser. Backup machen wenn du auf einen anderen Browser/PC wechseln willst.'}
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
        AI OFM • {user?.email || ''}
      </div>
    </div>
  )
}
