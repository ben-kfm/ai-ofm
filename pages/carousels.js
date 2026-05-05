import Link from 'next/link'
import { Layers, Sparkles, ImageIcon, Wand2, FolderUp, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from '../lib/store'

const ROADMAP = [
  { icon: ImageIcon, title: 'Soul-2-Starter sammeln', text: 'Drive-Ordner "Instagram Karussells" wird automatisch ausgelesen. Bilder werden 1.jpg, 2.jpg, ... nummeriert.' },
  { icon: Wand2, title: 'Claude-Bildanalyse', text: 'Pro Bild liefert Claude Opus: pose_prompt + lifestyle_1 + lifestyle_2 (siehe Project-Doku).' },
  { icon: Sparkles, title: 'Wan-2.7-Pro-Generierung', text: 'Slide .1 = Pose-Variation (mit Charakter), .2 + .3 = Lifestyle Shots (ohne Charakter). 768×1024 oder 1728×2304.' },
  { icon: FolderUp, title: 'Drive-Upload via Service Account', text: 'Naming 1.1, 1.2, 1.3, 2.1, ... — bestehender Service Account "lilly-automation@ob-research.iam.gserviceaccount.com" wird wiederverwendet.' }
]

export default function Carousels() {
  const { data } = useStore()
  const hasWaveSpeed = !!data.serviceKeys.wavespeed
  const hasAnthropic = !!data.serviceKeys.anthropic
  const ready = hasWaveSpeed && hasAnthropic

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="tile-icon" style={{ width: 56, height: 56 }}>
          <Layers size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Carousels</h1>
          <div className="muted">Soul-2 → Wan-2.7-Pro Karussell-Generierung</div>
        </div>
        <span className="tile-status soon" style={{ marginLeft: 'auto' }}>Coming Soon</span>
      </div>

      <div className="card">
        <div className="card-title"><Sparkles size={16} /> Workflow (aus Project-Doku)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
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

      <div className="card" style={{ borderColor: ready ? 'var(--green)' : 'var(--orange)' }}>
        <div className="card-title"><SettingsIcon size={16} /> Setup-Status</div>
        <div className="muted" style={{ marginBottom: 8, lineHeight: 1.7 }}>
          WaveSpeed-Key: {hasWaveSpeed ? '✓ vorhanden' : '✗ fehlt'}<br />
          Anthropic-Key: {hasAnthropic ? '✓ vorhanden' : '✗ fehlt'}<br />
          Drive Service Account: muss separat über Service-JSON eingebunden werden (kommt bei der Implementierung)
        </div>
        <Link href="/settings" className="btn btn-ghost btn-sm">Keys verwalten</Link>
      </div>

      <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
        Sag Bescheid wenn wir Carousels als Nächstes bauen sollen.
      </div>
    </div>
  )
}
