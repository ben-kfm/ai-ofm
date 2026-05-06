// Server-side Apify scraper — START phase only.
// Starts the Actor run and returns runId/datasetId immediately.
// Frontend polls /api/scrape-status until done. This bypasses Vercel Hobby's 60s limit.
//
// Body: { token, accounts: ["user1", ...], type: "posts"|"reels", limit: number }
// Response: { ok, runId, datasetId } or { error }

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { token, accounts, type, limit } = req.body || {}
  if (!token) return res.status(400).json({ error: 'Apify-Token fehlt' })
  if (!Array.isArray(accounts) || !accounts.length) return res.status(400).json({ error: 'Keine Accounts' })

  const usernames = accounts.map(a => String(a).replace('@', '').trim()).filter(Boolean)
  const actorId = type === 'reels' ? 'apify~instagram-reel-scraper' : 'apify~instagram-scraper'

  const input = type === 'reels'
    ? { username: usernames, resultsLimit: limit || 30 }
    : {
        directUrls: usernames.map(u => `https://www.instagram.com/${u}/`),
        resultsType: 'posts',
        resultsLimit: limit || 30,
        addParentData: false
      }

  // Force Residential — without this Instagram blocks every request.
  input.proxy = { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], apifyProxyCountry: 'US' }

  try {
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (!runRes.ok) {
      const errText = await runRes.text()
      return res.status(500).json({ error: `Apify-Start fehlgeschlagen: ${runRes.status} ${errText.slice(0, 200)}` })
    }
    const runJson = await runRes.json()
    return res.status(200).json({
      ok: true,
      runId: runJson.data.id,
      datasetId: runJson.data.defaultDatasetId
    })
  } catch (e) {
    return res.status(500).json({ error: 'Scrape-Start-Fehler: ' + (e.message || String(e)) })
  }
}
