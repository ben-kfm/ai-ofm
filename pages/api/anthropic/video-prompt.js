// Anthropic Claude — Convert Gemini's video analysis into a Seedance prompt
// POST { anthropicKey, analysis, metaPrompt } → { ok, prompt }

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { anthropicKey, analysis, metaPrompt } = req.body || {}
  if (!anthropicKey) return res.status(400).json({ error: 'Anthropic-Key fehlt (Settings)' })
  if (!analysis) return res.status(400).json({ error: 'Analyse fehlt' })

  const userMsg = `Here is a detailed analysis of a viral short-form video:

<analysis>
${analysis}
</analysis>

Based on this analysis, write the Seedance 2.0 image-to-video prompt as instructed.`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: metaPrompt || 'You are a creative director writing prompts for Seedance 2.0 image-to-video. Output only the prompt, 50-90 words, no preamble.',
        messages: [{ role: 'user', content: userMsg }]
      })
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(r.status).json({ error: `Anthropic ${r.status}: ${t.slice(0, 400)}` })
    }
    const j = await r.json()
    let prompt = j.content?.[0]?.text || ''
    // Strip surrounding quotes if Claude added them
    prompt = prompt.trim().replace(/^["'`]|["'`]$/g, '').trim()
    if (!prompt) return res.status(500).json({ error: 'Claude lieferte keinen Prompt' })
    return res.status(200).json({ ok: true, prompt })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
