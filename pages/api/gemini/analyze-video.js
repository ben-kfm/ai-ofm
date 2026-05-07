// Google Gemini — Video analysis for reel recreation
// Tries newest model first; falls back to older models on 429 (quota) since each model has its own quota pool.
//
// POST { geminiKey, videoUrl, prompt }
// Returns: { ok, analysis, modelUsed }

export const config = { maxDuration: 60 }

// Order: best/newest first. Each model has separate free-tier quotas.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

async function callGemini(model, key, mimeType, base64, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
    })
  })
  return r
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { geminiKey, videoUrl, prompt } = req.body || {}
  if (!geminiKey) return res.status(400).json({ error: 'Gemini-Key fehlt (Settings)' })
  if (!videoUrl) return res.status(400).json({ error: 'Video-URL fehlt' })
  if (!prompt) return res.status(400).json({ error: 'Analyse-Prompt fehlt' })

  try {
    // Fetch with timeout (30s) — Instagram CDN can be slow
    const ctrl = new AbortController()
    const fetchTimeout = setTimeout(() => ctrl.abort(), 30000)
    let vRes
    try {
      vRes = await fetch(videoUrl, { signal: ctrl.signal })
    } catch (e) {
      clearTimeout(fetchTimeout)
      return res.status(500).json({ error: `Video-Download Timeout/Fehler: ${e.message}` })
    }
    clearTimeout(fetchTimeout)
    if (!vRes.ok) return res.status(500).json({ error: `Video-Fetch ${vRes.status}` })
    const buf = Buffer.from(await vRes.arrayBuffer())
    const sizeMB = buf.length / 1024 / 1024
    // Hard cap at 12MB raw — base64-encoded becomes ~16MB, leaves room for Gemini's 20MB inline limit
    if (sizeMB > 12) return res.status(400).json({
      error: `Reel zu groß (${sizeMB.toFixed(1)}MB). Gemini akzeptiert max 12MB inline. Wähle ein kürzeres Reel oder eines mit weniger Daten.`
    })

    const base64 = buf.toString('base64')
    const mimeType = vRes.headers.get('content-type')?.split(';')[0] || 'video/mp4'

    let lastErr = null
    for (const model of MODELS) {
      const r = await callGemini(model, geminiKey, mimeType, base64, prompt)
      if (r.ok) {
        const j = await r.json()
        const analysis = j.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (!analysis) { lastErr = `${model} kein Text geliefert`; continue }
        return res.status(200).json({ ok: true, analysis, modelUsed: model, sizeMB: sizeMB.toFixed(1) })
      }
      const errText = await r.text()
      lastErr = `${model}: ${r.status} ${errText.slice(0, 200)}`
      // 429 = quota exceeded → try next model. 404 = model name wrong → try next. Other errors → stop.
      if (r.status !== 429 && r.status !== 404) break
    }
    return res.status(429).json({
      error: `Alle Gemini-Modelle haben Quota erschöpft oder Fehler. Free-Tier ist begrenzt — entweder 1 Minute warten oder Billing aktivieren auf https://aistudio.google.com/app/billing\n\nLast error: ${lastErr}`
    })
  } catch (e) {
    return res.status(500).json({ error: 'Analyse-Fehler: ' + (e.message || String(e)) })
  }
}
