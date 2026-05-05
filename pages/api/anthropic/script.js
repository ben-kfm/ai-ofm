// Anthropic Claude — Generate image+video prompts from persona + topic
// POST { anthropicKey, systemPrompt, topic } → { ok, imagePrompt, videoDirection }

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { anthropicKey, systemPrompt, topic } = req.body || {}
  if (!anthropicKey) return res.status(400).json({ error: 'Anthropic-Key fehlt (Settings)' })
  if (!topic) return res.status(400).json({ error: 'Topic fehlt' })

  const userMessage = `Generate content for a 9:16 short-form video on this topic: "${topic}"

Return ONLY valid JSON in this exact shape:
{
  "image_prompt": "<vivid description of the SETTING/SCENE for an AI image generator. Keep the character consistent with the reference. Mention lighting, mood, location, props. 2-3 sentences. Do NOT describe the character's face/body — that comes from the reference image.>",
  "video_direction": "<description of the natural micro-motion for the video: subtle camera movement (anti-zoom, slow push-in, idle), facial expression evolution (a soft smile forming, eyes glancing), breathing. 1-2 sentences. NO drastic motion.>"
}`

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
        max_tokens: 600,
        system: systemPrompt || 'You are a creative director for short-form video content.',
        messages: [{ role: 'user', content: userMessage }]
      })
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(r.status).json({ error: `Anthropic ${r.status}: ${t.slice(0,300)}` })
    }
    const j = await r.json()
    const text = j.content?.[0]?.text || ''
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(500).json({ error: 'Kein JSON in Response: ' + text.slice(0,200) })
    let parsed
    try { parsed = JSON.parse(match[0]) }
    catch (e) { return res.status(500).json({ error: 'JSON parse: ' + e.message }) }
    return res.status(200).json({
      ok: true,
      imagePrompt: parsed.image_prompt || '',
      videoDirection: parsed.video_direction || ''
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
