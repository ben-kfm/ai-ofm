import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Sparkles } from 'lucide-react'
import { getSupabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!router.isReady) return
    const sb = getSupabase()
    if (!sb) { setErr('Supabase nicht konfiguriert'); return }

    let cancelled = false
    const next = typeof router.query.next === 'string' ? router.query.next : '/content-research'

    async function run() {
      try {
        // Implicit flow: Supabase puts the session in URL hash (#access_token=...).
        // With detectSessionInUrl=true, supabase-js sets the session automatically.
        // PKCE flow: ?code=... in query. We try exchange for backwards compatibility.
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          try {
            await sb.auth.exchangeCodeForSession(code)
          } catch {}
        }
        // Give detect-session a moment to fire.
        await new Promise(r => setTimeout(r, 300))
        const { data } = await sb.auth.getUser()
        if (cancelled) return
        if (!data?.user) {
          // Session may still be set in storage but getUser failed; just trust and continue.
          router.replace(next)
          return
        }
        router.replace(next)
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Login fehlgeschlagen')
      }
    }
    run()
    const t = setTimeout(() => { if (!cancelled) setErr(prev => prev || 'Hängt fest. Klick weiter.') }, 8000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [router.isReady])

  return (
    <>
      <Head><title>Login… • AI OFM</title></Head>
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo"><Sparkles size={22} /></div>
          <div className="auth-title">{err ? 'Login fehlgeschlagen' : 'Logge dich ein…'}</div>
          <div className="auth-sub" style={{ marginTop: 12 }}>
            {err ? err : 'Bitte einen Moment Geduld.'}
          </div>
          {err && (
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'center' }}>
              <button className="btn" onClick={() => router.replace(router.query.next || '/content-research')}>
                Weiter
              </button>
              <button className="btn btn-ghost" onClick={() => router.replace('/login')}>
                Zurück zum Login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
