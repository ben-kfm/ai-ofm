// Poll a WaveSpeed task — used for long-running video gens
// POST { wavespeedKey, taskId } → { status, urls? }

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { wavespeedKey, taskId } = req.body || {}
  if (!wavespeedKey || !taskId) return res.status(400).json({ error: 'Missing key or taskId' })

  try {
    const r = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
      headers: { 'Authorization': `Bearer ${wavespeedKey}` }
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(r.status).json({ error: `Poll ${r.status}: ${t.slice(0,200)}` })
    }
    const j = await r.json()
    const status = j.data?.status || j.status
    const outputs = j.data?.outputs || j.outputs || []
    return res.status(200).json({ status, urls: outputs })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
