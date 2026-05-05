import Link from 'next/link'
import { Video, Sparkles, Upload, Wand2, Download, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from '../lib/store'

const ROADMAP = [
  { icon: Upload, title: 'Bilder hochladen', text: 'Soul-2-Starter oder eigene Fotos via Drag & Drop. Mehrere parallel.' },
  { icon: Wand2, title: 'Motion-Prompt setzen', text: 'Pose-Variation, Camera-Move, oder freier Text. Library mit fertigen Prompts (wie bei Carousels).' },
  { icon: Sparkles, title: 'Generieren via Seedance / Kling', text: 'Server-side API-Call, Polling, Status-Anzeige.' },
  { icon: Download, title: 'Auto-Drive-Sync', text: 'Fertige Videos werden in den Drive-Ordner "Lilly Videos" geschoben mit Auto-Naming.' }
]

export default function VideoCreation() {
  const { data } = useStore()
  const hasKey = !!(data.serviceKeys.seedance || data.serviceKeys.falai)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="tile-icon" style={{ width: 56, height: 56 }}>
          <Video size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Video Creation</h1>
          <div className="muted">Image-to-Video mit Seedance, Kling, fal.ai</div>
        </div>
        <span className="tile-status soon" style={{ marginLeft: 'auto' }}>Coming Soon</span>
      </div>

      <div className="card">
        <div className="card-title"><Sparkles size={16} /> Was gebaut wird</div>
        <div className="muted" style={{ marginBottom: 16 }}>
          Diese Automation nimmt deine Soul-2-Starter (oder beliebige Bilder) und generiert daraus animierte Clips. Stack: Replicate / fal.ai für Seedance, optional direkt Kling 3.0 API.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ROADMAP.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg3)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{step.title}</div>
                  <div className="muted" style={{ marginTop: 2 }}>{step.text}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ borderColor: hasKey ? 'var(--green)' : 'var(--orange)' }}>
        <div className="card-title"><SettingsIcon size={16} /> Setup-Status</div>
        <div className="muted" style={{ marginBottom: 8 }}>
          {hasKey
            ? 'Service-Key eingetragen ✓ — sobald die Automation gebaut ist, kannst du sofort generieren.'
            : 'Noch kein Seedance/fal.ai-Key eingetragen. Sobald die Automation gebaut wird, brauchst du einen.'}
        </div>
        <Link href="/settings" className="btn btn-ghost btn-sm">
          {hasKey ? 'Keys verwalten' : 'Key eintragen →'}
        </Link>
      </div>

      <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
        Wenn du bereit bist, sag mir Bescheid und wir bauen Video Creation als nächstes.
      </div>
    </div>
  )
}
