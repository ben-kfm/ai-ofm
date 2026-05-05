import Link from 'next/link'
import { Search, Video, Layers, ArrowRight, Activity, Star, Bookmark } from 'lucide-react'
import { useStore } from '../lib/store'

const TILES = [
  {
    href: '/content-research',
    icon: Search,
    title: 'Content Research',
    description: 'Instagram-Posts und Reels via Apify scrapen, Most Viral / Highest Converting filtern, Kanban-Board für Workflow.',
    status: 'live',
    statusLabel: 'Live'
  },
  {
    href: '/video-creation',
    icon: Video,
    title: 'Video Creation',
    description: 'Image-to-Video mit Seedance / Kling. Bilder hochladen, Motion-Prompt setzen, fertige Clips abholen.',
    status: 'soon',
    statusLabel: 'Coming Soon'
  },
  {
    href: '/carousels',
    icon: Layers,
    title: 'Carousels',
    description: 'Soul-2-Starter → Wan-2.7-Pro Pose-Variation + 2 Lifestyle Shots. Auto-Naming 1.1 / 1.2 / 1.3.',
    status: 'soon',
    statusLabel: 'Coming Soon'
  }
]

export default function Dashboard() {
  const { data, loaded } = useStore()
  if (!loaded) return null

  const totalPosts = (data.research.sessions || []).reduce((s, x) => s + (x.count || 0), 0)
  const kanbanCount = data.research.kanban.backlog.length + data.research.kanban.inprogress.length + data.research.kanban.done.length
  const favCount = data.research.favorites.length

  const stats = [
    { icon: Activity, label: 'Posts gescrapt', value: totalPosts },
    { icon: Bookmark, label: 'Im Kanban', value: kanbanCount },
    { icon: Star, label: 'Favoriten', value: favCount }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Hero */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Willkommen, BOSS 👋</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Deine Automation-Suite für AI Influencer Management.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
                <div className="muted">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Automations */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Automations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {TILES.map(t => {
            const Icon = t.icon
            const inner = (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="tile-icon"><Icon size={22} /></div>
                  <span className={`tile-status ${t.status}`}>{t.statusLabel}</span>
                </div>
                <div>
                  <div className="tile-title">{t.title}</div>
                  <div className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
                  Öffnen <ArrowRight size={14} style={{ marginLeft: 4, marginTop: 1 }} />
                </div>
              </>
            )
            return (
              <Link key={t.href} href={t.href} className={`tile ${t.status === 'soon' ? '' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {inner}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Setup-Status */}
      {data.apifyKeys.length === 0 && (
        <div className="card" style={{ borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Erste Schritte</div>
            <div className="muted" style={{ marginTop: 2 }}>Trag deinen Apify-Token in den Settings ein, dann kann Content Research loslegen.</div>
          </div>
          <Link href="/settings" className="btn">Zu Settings →</Link>
        </div>
      )}
    </div>
  )
}
