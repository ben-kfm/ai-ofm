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

    async function run() {
      try {
        // PKCE flow: ?code=...
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          // Implicit / fragment flow fallback
          const hash = window.location.hash
          if (hash && hash.includes('access_token')) {
            // supabase-js auto-detects the session from URL hash on init.
            await new Promise(r => setTimeout(r, 200))
          }
        }
        const next = router.query.next || '/content-research'
        router.replace(typeof next === 'string' ? next : '/content-research')
      } catch (e) {
        setErr(e.message || 'Login fehlgeschlagen')
      }
    }
    run()
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
            <button className="btn" style={{ marginTop: 18 }} onClick={() => router.replace('/login')}>
              Zurück zum Login
            </button>
          )}
        </div>
      </div>
    </>
  )
}
