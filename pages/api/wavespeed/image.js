// WaveSpeed Nano Banana Pro — Image generation
// POST { wavespeedKey, prompt, refImageUrl?, resolution, aspectRatio, format, jpegQuality, seed, count }
// Returns: { ok, urls: [...] }

export const config = { maxDuration: 60 }

const MODEL_ENDPOINT = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/text-to-image'
const EDIT_ENDPOINT  = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const {
    wavespeedKey, prompt, refImageUrl,
    resolution = 2048, aspectRatio = '9:16',
    format = 'jpeg', jpegQuality = 92,
    seed = 0, count = 1
  } = req.body || {}

  if (!wavespeedKey) return res.status(400).json({ error: 'WaveSpeed-Key fehlt (Settings)' })
  if (!prompt) return res.status(400).json({ error: 'Prompt fehlt' })

  // Map resolution + aspect to width × height
  const aspect = aspectRatio.split(':').map(Number)
  const ratio = aspect[0] / aspect[1]
  const longSide = Number(resolution) || 2048
  let width, height
  if (ratio < 1) {                  // portrait
    height = longSide
    width = Math.round(longSide * ratio)
  } else {
    width = longSide
    height = Math.round(longSide / ratio)
  }
  // Round to multiples of 64
  width  = Math.round(width  / 64) * 64
  height = Math.round(height / 64) * 64
  const sizeStr = `${width}*${height}`

  const isEdit = !!refImageUrl
  const endpoint = isEdit ? EDIT_ENDPOINT : MODEL_ENDPOINT

  const body = {
    prompt,
    size: sizeStr,
    output_format: format,
    seed: seed || -1,
    num_images: count
  }
  if (isEdit) body.images = [refImageUrl]
  if (format === 'jpeg') body.quality = jpegQuality

  try {
    // Submit task
    const submitRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wavespeedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (!submitRes.ok) {
      const t = await submitRes.text()
      return res.status(submitRes.status).json({ error: `WaveSpeed submit ${submitRes.status}: ${t.slice(0,300)}` })
    }
    const submit = await submitRes.json()
    const taskId = submit.data?.id || submit.id
    if (!taskId) return res.status(500).json({ error: 'Kein Task-ID von WaveSpeed' })

    // Poll for result
    const deadline = Date.now() + 55 * 1000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const pollRes = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${wavespeedKey}` }
      })
      if (!pollRes.ok) continue
      const poll = await pollRes.json()
      const status = poll.data?.status || poll.status
      if (status === 'completed') {
        const outputs = poll.data?.outputs || poll.outputs || []
        return res.status(200).json({ ok: true, urls: outputs, taskId })
      }
      if (status === 'failed' || status === 'error') {
        return res.status(500).json({ error: 'Generation failed: ' + (poll.data?.error || 'unknown') })
      }
    }
    return res.status(504).json({ error: 'Timeout — Image-Gen dauert >55s. Try smaller resolution.', taskId })
  } catch (e) {
    return res.status(500).json({ error: 'Fetch error: ' + (e.message || String(e)) })
  }
}
