# AI OFM

**Automation Suite for AI Influencer / OnlyFans Management** — built for and with BOSS.

Multi-page Next.js webapp deployed on Vercel. Modular architecture so new automations can be added incrementally without touching existing ones.

## Modules

| Module | Status | What it does |
|---|---|---|
| **Dashboard** | live | Overview tiles, quick stats, setup health |
| **Content Research** | live | Instagram scraping via Apify (Posts/Reels), Most-Viral / Highest-Converting filter, Kanban board, VA-export |
| **Video Creation** | soon | Image-to-Video with Seedance / Kling / fal.ai |
| **Carousels** | soon | Soul-2 → Wan-2.7-Pro pipeline (Pose + 2 Lifestyle Shots), Drive auto-upload |
| **Settings** | live | Multi-Apify-Key management, Service-Keys for all integrations, Backup |

## Setup

See [SETUP.md](./SETUP.md) for step-by-step deployment to Vercel (10–15 min).

## Architecture

```
pages/
  _app.js              # StoreProvider + Layout wrapper
  index.js             # Dashboard
  content-research.js  # Argus module
  video-creation.js    # Coming soon
  carousels.js         # Coming soon
  settings.js          # Multi-key + service keys
  api/
    scrape.js          # Server-side Apify wrapper (Residential proxy forced)
components/
  Layout.js            # Sidebar + topbar shell (Higgsfield-inspired)
lib/
  storage.js           # localStorage wrapper, migrations from legacy ARGUS
  store.js             # React Context store (single source of truth)
styles/
  globals.css          # Theme variables (dark/light), shared components
```

Data lives client-side in `localStorage` (key: `ai_ofm_data_v1`). Auto-migration from `argus2_data_v1` and `argus2_data_v2` if present.
