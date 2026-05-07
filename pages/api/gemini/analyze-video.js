// Google Gemini 2.0 Flash — Video analysis for reel recreation
// Pipeline: download video → upload to Gemini Files API → analyze with prompt → return text
//
// POST { geminiKey, videoUrl, prompt }
// Returns: { ok, analysis }

export const config = { maxDuration: 60 }

const MODEL = 'gemini-2.0-flash-exp'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { geminiKey, videoUrl, prompt } = req.body || {}
  if (!geminiKey) return res.status(400).json({ error: 'Gemini-Key fehlt (Settings)' })
  if (!videoUrl) return res.status(400).json({ error: 'Video-URL fehlt' })
  if (!prompt) return res.status(400).json({ error: 'Analyse-Prompt fehlt' })

  try {
    // 1. Fetch video bytes
    const vRes = await fetch(videoUrl)
    if (!vRes.ok) return res.status(500).json({ error: `Video-Fetch ${vRes.status}` })
    const buf = Buffer.from(await vRes.arrayBuffer())
    const sizeMB = buf.length / 1024 / 1024
    if (sizeMB > 20) return res.status(400).json({ error: `Video zu groß (${sizeMB.toFixed(1)}MB) — max 20MB für Inline` })

    // 2. Use inline data path (videos < 20MB can be sent directly without Files API)
    const base64 = buf.toString('base64')
    const mimeType = vRes.headers.get('content-type')?.split(';')[0] || 'video/mp4'

    // 3. Generate content
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`
    const genRes = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1500
        }
      })
    })
    if (!genRes.ok) {
      const t = await genRes.text()
      return res.status(genRes.status).json({ error: `Gemini ${genRes.status}: ${t.slice(0, 400)}` })
    }
    const j = await genRes.json()
    const analysis = j.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!analysis) return res.status(500).json({ error: 'Gemini lieferte keinen Text: ' + JSON.stringify(j).slice(0, 300) })

    return res.status(200).json({ ok: true, analysis, sizeMB: sizeMB.toFixed(1) })
  } catch (e) {
    return res.status(500).json({ error: 'Analyse-Fehler: ' + (e.message || String(e)) })
  }
}
