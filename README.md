# AI OFM

**Content Research Suite** — Instagram-Scraping per Apify mit Most-Viral / Highest-Converting Filter, Kanban-Board, geteiltem Workspace.

Next.js 14 (Pages Router) auf Vercel, Auth + geteilte Daten via Supabase (Magic Link).

## Module

| Modul | Status | Was es macht |
|---|---|---|
| **Content Research** | live | Instagram-Scraping via Apify (Posts/Reels), Most-Viral / Highest-Converting Filter, Kanban-Board, VA-Export |
| **Settings** | live | Multi-Apify-Key management + Team-Einladungen + Backup |

## Setup

Auth & Cloud-Backend einrichten: siehe [SETUP-AUTH.md](./SETUP-AUTH.md).

### Quickstart Dev
```bash
npm install
cp .env.example .env.local
# .env.local mit echten Supabase-Keys füllen
npm run dev
```
App läuft dann auf http://localhost:3000

Falls keine Supabase-Keys gesetzt sind: App läuft im lokalen Single-User-Modus (kein Login, Daten in localStorage).

## Architektur

```
pages/
  _app.js                # AuthProvider + StoreProvider + Layout-Wrapper
  index.js               # → Redirect zu /content-research (oder /login)
  login.js               # Magic-Link Login
  auth/callback.js       # OAuth-Callback (exchange code → session)
  auth/error.js          # "Kein Zugriff" / generic auth errors
  content-research.js    # Hauptmodul
  settings.js            # Apify-Keys, Team-Einladungen, Backup
  api/
    scrape.js            # Apify-Run starten
    scrape-status.js     # Apify-Run pollen
    img.js               # Instagram-CDN Proxy
    invite.js            # Admin-only: Einladen / Zugriff entziehen
components/
  Layout.js              # Sidebar mit User-Info + Logout
lib/
  supabase.js            # Supabase Browser-Client
  auth.js                # AuthContext + Allowlist-Check
  storage.js             # Cloud-first, localStorage-Fallback
  store.js               # Globaler State + Realtime-Sync
styles/
  globals.css            # Topaz-Style: dunkelblau / cyan
supabase-schema.sql      # DB-Schema (allowed_users + app_state)
SETUP-AUTH.md            # Setup-Anleitung
```

## Daten-Modell

- **`allowed_users`** — Whitelist von Mails, die sich einloggen dürfen. `is_admin=true` Admins können einladen.
- **`app_state`** — eine einzige Zeile (`id='singleton'`), in der der gesamte App-State als JSON liegt. Geteilt zwischen allen eingeloggten Usern. Last-write-wins mit Realtime-Sync (~1 Sek. Latenz).

## Sicherheit

- Magic-Link: kein Passwort, kurzlebige Tokens.
- Allowlist: nur Mails in `allowed_users` können sich einloggen (Doppel-Check: clientseitig + RLS).
- RLS-Policies: nur authentifizierte, gelistete User dürfen `app_state` lesen/schreiben.
- Service-Role-Key nur server-seitig in `/api/invite.js`.

## License

Private — built for BOSS.
