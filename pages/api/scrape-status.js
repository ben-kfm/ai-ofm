// Poll an Apify run by runId. Returns status; if SUCCEEDED, also fetches the dataset items.
//
// Body: { token, runId, datasetId, daysBack?: number }
// Response: { status, items?, total? }

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { token, runId, datasetId, daysBack } = req.body || {}
  if (!token || !runId) return res.status(400).json({ error: 'token + runId required' })

  try {
    const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`)
    if (!sRes.ok) {
      const errText = await sRes.text()
      return res.status(500).json({ error: `Status-Fetch ${sRes.status}: ${errText.slice(0, 200)}` })
    }
    const sJson = await sRes.json()
    const status = sJson.data.status
    const stats = sJson.data.stats || {}

    // Still running — return progress info
    if (['RUNNING', 'READY'].includes(status)) {
      return res.status(200).json({
        status,
        runtimeSecs: stats.runTimeSecs || 0,
        itemsScraped: sJson.data.defaultDatasetItemCount || 0
      })
    }

    if (status !== 'SUCCEEDED') {
      return res.status(200).json({
        status,
        error: `Run endete als ${status}. Bei "FAILED" mit Free-Tier-Apify: oft fehlt Residential-Proxy → Instagram blockt. Lösung: Apify Starter ($49/mo).`
      })
    }

    // Done — fetch dataset
    const ds = datasetId || sJson.data.defaultDatasetId
    const dRes = await fetch(`https://api.apify.com/v2/datasets/${ds}/items?token=${encodeURIComponent(token)}`)
    if (!dRes.ok) return res.status(500).json({ error: 'Dataset-Fetch fehlgeschlagen' })
    const items = await dRes.json()

    const cutoffMs = daysBack ? Date.now() - daysBack * 86400000 : 0
    const filtered = cutoffMs
      ? items.filter(i => {
          const ts = new Date(i.timestamp || i.takenAtTimestamp || 0).getTime()
          return ts >= cutoffMs
        })
      : items

    return res.status(200).json({
      status: 'SUCCEEDED',
      items: filtered,
      total: filtered.length,
      runtimeSecs: stats.runTimeSecs || 0
    })
  } catch (e) {
    return res.status(500).json({ error: 'Status-Fehler: ' + (e.message || String(e)) })
  }
}
