import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Sparkles, Mail, ArrowRight } from 'lucide-react'
import { getSupabase, supabaseEnabled } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e?.preventDefault()
    setErr(null)
    const value = email.trim().toLowerCase()
    if (!value || !value.includes('@')) { setErr('Bitte gib eine gültige E-Mail ein.'); return }
    if (!supabaseEnabled) { setErr('Auth ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL fehlt).'); return }
    setSending(true)
    try {
      const sb = getSupabase()
      const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(router.query.next || '/content-research')}`
      const { error } = await sb.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: redirect, shouldCreateUser: true }
      })
      if (error) throw error
      setSent(true)
    } catch (e) {
      setErr(e.message || 'Senden fehlgeschlagen')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Head><title>Login • AI OFM</title></Head>
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo"><Sparkles size={22} /></div>
          <div className="auth-title">AI OFM</div>
          <div className="auth-sub">Trag deine E-Mail ein. Du bekommst einen einmaligen Login-Link von uns geschickt.</div>

          {!sent ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text3)' }} />
                <input
                  className="inp"
                  style={{ paddingLeft: 36 }}
                  type="email"
                  placeholder="du@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={sending} style={{ justifyContent: 'center' }}>
                {sending ? 'Sende Link…' : <>Login-Link senden <ArrowRight size={14} /></>}
              </button>
              {err && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center' }}>{err}</div>}
              <div className="muted" style={{ textAlign: 'center', marginTop: 4, fontSize: 11 }}>
                Du musst vom Admin eingeladen sein, sonst funktioniert der Login nicht.
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '14px 4px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Check deine Inbox ✉️</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                Wir haben einen Login-Link an <strong>{email}</strong> geschickt.<br />
                Klick auf den Link in der Mail, um eingeloggt zu werden.
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={() => { setSent(false); setEmail('') }}>
                Andere Mail verwenden
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
