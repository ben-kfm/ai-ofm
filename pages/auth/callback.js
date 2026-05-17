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
        // With @supabase/ssr, the auth-token cookie is set by Supabase server before
        // redirecting here. So usually we just need to check the session and route on.
        // If the cookie isn't there yet, fall back to the explicit PKCE exchange.
        let user = null
        try {
          const { data } = await sb.auth.getUser()
          user = data?.user || null
        } catch {}

        if (!user) {
          const code = new URL(window.location.href).searchParams.get('code')
          if (code) {
            const { error } = await sb.auth.exchangeCodeForSession(code)
            if (error) throw error
            const { data: re } = await sb.auth.getUser()
            user = re?.user || null
          }
        }

        if (cancelled) return
        if (!user) throw new Error('Session konnte nicht geöffnet werden. Versuch nochmal.')
        router.replace(next)
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Login fehlgeschlagen')
      }
    }
    run()
    // Safety: if we're still stuck after 7s, surface a manual continue button.
    const t = setTimeout(() => { if (!cancelled) setErr(prev => prev || 'Hängt fest. Klick weiter.') }, 7000)
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
