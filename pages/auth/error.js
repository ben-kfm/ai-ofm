import Head from 'next/head'
import { useRouter } from 'next/router'
import { ShieldAlert } from 'lucide-react'

const REASONS = {
  not_allowed: {
    title: 'Kein Zugriff',
    msg: 'Deine E-Mail ist nicht freigeschaltet. Bitte den Admin, dich einzuladen.'
  },
  generic: {
    title: 'Login fehlgeschlagen',
    msg: 'Beim Login ist etwas schiefgelaufen. Versuch es nochmal.'
  }
}

export default function AuthError() {
  const router = useRouter()
  const reason = REASONS[router.query.reason] || REASONS.generic

  return (
    <>
      <Head><title>Kein Zugriff • AI OFM</title></Head>
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}>
            <ShieldAlert size={22} />
          </div>
          <div className="auth-title">{reason.title}</div>
          <div className="auth-sub">{reason.msg}</div>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => router.replace('/login')}>
            Zurück zum Login
          </button>
        </div>
      </div>
    </>
  )
}
