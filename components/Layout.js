import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  LayoutDashboard, Search, Video, Layers, Settings,
  Sun, Moon, Sparkles
} from 'lucide-react'
import { useStore } from '../lib/store'

const NAV = [
  {
    section: 'Übersicht',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    section: 'Automations',
    items: [
      { href: '/content-research', label: 'Content Research', icon: Search, badge: 'live' },
      { href: '/video-creation', label: 'Video Creation', icon: Video, badge: 'soon' },
      { href: '/carousels', label: 'Carousels', icon: Layers, badge: 'soon' }
    ]
  },
  {
    section: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings }
    ]
  }
]

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/content-research': 'Content Research',
  '/video-creation': 'Video Creation',
  '/carousels': 'Carousels',
  '/settings': 'Settings'
}

export default function Layout({ children }) {
  const router = useRouter()
  const { data, update, toasts } = useStore()

  const toggleTheme = () => update({ theme: data.theme === 'dark' ? 'light' : 'dark' })
  const activeKey = data.apifyKeys.find(k => k.id === data.activeApifyKeyId)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Sparkles size={18} /></div>
          <div className="sidebar-logo-text">
            AI OFM
            <span>Automation Suite</span>
          </div>
        </div>

        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(it => {
              const Icon = it.icon
              const isActive = router.pathname === it.href
              return (
                <Link key={it.href} href={it.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{it.label}</span>
                  {it.badge && <span className="badge">{it.badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="nav-item" onClick={toggleTheme} role="button">
            {data.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{data.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{PAGE_TITLES[router.pathname] || ''}</div>
          <div className="topbar-actions">
            {activeKey && (
              <div className="muted" style={{ marginRight: 4 }}>
                🔑 {activeKey.label}
              </div>
            )}
            {data.apifyKeys.length > 1 && (
              <select
                className="inp inp-sm"
                style={{ width: 'auto' }}
                value={data.activeApifyKeyId || ''}
                onChange={e => update({ activeApifyKeyId: e.target.value })}
                title="Aktiver Apify-Key"
              >
                {data.apifyKeys.map(k => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="page">{children}</div>
      </div>

      <div className="toast-host">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}
