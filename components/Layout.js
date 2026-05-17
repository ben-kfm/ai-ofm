import { useRouter } from 'next/router'
import Link from 'next/link'
import { Search, Settings, Sun, Moon, Sparkles, LogOut } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'

const NAV = [
  {
    section: 'Workspace',
    items: [
      { href: '/content-research', label: 'Content Research', icon: Search, badge: 'live' }
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
  '/': 'Content Research',
  '/content-research': 'Content Research',
  '/settings': 'Settings'
}

export default function Layout({ children }) {
  const router = useRouter()
  const { data, update, toasts } = useStore()
  const { user, isAdmin, signOut, loading } = useAuth()

  const toggleTheme = () => update({ theme: data.theme === 'dark' ? 'light' : 'dark' })
  const activeKey = data.apifyKeys.find(k => k.id === data.activeApifyKeyId)
  const initials = (user?.email || '?').slice(0, 2).toUpperCase()

  // While auth resolves, show a skinny placeholder so we never flash unauthed content.
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Lade…
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Sparkles size={18} /></div>
          <div className="sidebar-logo-text">
            AI OFM
            <span>Content Research</span>
          </div>
        </div>

        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(it => {
              const Icon = it.icon
              const isActive = router.pathname === it.href || (it.href === '/content-research' && router.pathname === '/')
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
          {user && (
            <div className="sidebar-user" title={user.email}>
              <div className="sidebar-user-avatar">{initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sidebar-user-mail">{user.email}</div>
                <div className="sidebar-user-role">{isAdmin ? 'Admin' : 'Member'}</div>
              </div>
            </div>
          )}
          <div className="nav-item" onClick={toggleTheme} role="button">
            {data.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{data.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          {user && (
            <div className="nav-item" onClick={signOut} role="button">
              <LogOut size={16} />
              <span>Logout</span>
            </div>
          )}
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
