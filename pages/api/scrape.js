// Server-side Apify scraper. The user's token never reaches the browser.
//
// Body: { token, accounts: ["user1", ...], type: "posts"|"reels", daysBack: number, limit: number }
// Response: { ok, items, total } or { error }

export const config = { maxDuration: 300 } // Vercel Hobby allows up to 60s, Pro up to 300s; this is a hint.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { token, accounts, type, daysBack, limit } = req.body || {}
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
    // Start the actor run
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
    const runId = runJson.data.id
    const datasetId = runJson.data.defaultDatasetId

    // Poll for max ~55s (Vercel Hobby kills after 60s)
    const deadline = Date.now() + 55 * 1000
    let status = 'RUNNING'
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000))
      const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`)
      if (!sRes.ok) break
      const sData = await sRes.json()
      status = sData.data.status
      if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break
    }

    if (status === 'RUNNING') {
      return res.status(504).json({
        error: `Run läuft noch nach 55s. Auf Vercel Hobby Plan ist die Ausführungszeit limitiert. Probier weniger Accounts oder kleineres Limit.`,
        runId
      })
    }
    if (status !== 'SUCCEEDED') {
      return res.status(500).json({
        error: `Run endete als ${status}. Häufige Ursache: Free-Tier-Apify-Account ohne Residential-Proxy → Instagram blockt alle Requests. Lösung: Apify Starter ($49/mo) auf einem Account.`
      })
    }

    // Fetch dataset
    const dRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}`)
    if (!dRes.ok) return res.status(500).json({ error: 'Dataset-Fetch fehlgeschlagen' })
    const items = await dRes.json()

    // Optional cutoff filter
    const cutoffMs = daysBack ? Date.now() - daysBack * 86400000 : 0
    const filtered = cutoffMs
      ? items.filter(i => {
          const ts = new Date(i.timestamp || i.takenAtTimestamp || 0).getTime()
          return ts >= cutoffMs
        })
      : items

    return res.status(200).json({ ok: true, items: filtered, total: filtered.length })
  } catch (e) {
    return res.status(500).json({ error: 'Scrape-Fehler: ' + (e.message || String(e)) })
  }
}
