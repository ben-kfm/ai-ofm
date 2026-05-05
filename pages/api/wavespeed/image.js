// WaveSpeed Nano Banana Pro — Image generation
// POST { wavespeedKey, prompt, refImage?, resolution, aspectRatio, format, jpegQuality, seed, count }
// refImage can be either http URL or data: URL (will be uploaded to catbox.moe)
// Returns: { ok, urls: [...], taskId }

export const config = { maxDuration: 60 }

// Always use the same endpoint — refImage goes in the `images` array in the body
// (Nano Banana Pro is multimodal — it conditions on reference images for character consistency)
const ENDPOINT = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/text-to-image'
const ENDPOINT_MULTI = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/text-to-image-multi'
const ENDPOINT_ULTRA = 'https://api.wavespeed.ai/api/v3/google/nano-banana-pro/text-to-image-ultra'

// Upload a data: URL to catbox.moe (free, no auth) and return public URL
async function dataUrlToHttp(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('Invalid data URL')
  const mime = m[1]
  const ext = mime.split('/')[1] || 'jpg'
  const buf = Buffer.from(m[2], 'base64')

  const fd = new FormData()
  fd.append('reqtype', 'fileupload')
  fd.append('fileToUpload', new Blob([buf], { type: mime }), `ref.${ext}`)

  const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`catbox upload ${r.status}`)
  const url = (await r.text()).trim()
  if (!url.startsWith('http')) throw new Error('catbox returned: ' + url.slice(0, 100))
  return url
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const {
    wavespeedKey, prompt, refImage,
    resolution = 2048, aspectRatio = '9:16',
    format = 'jpeg', jpegQuality = 92,
    seed = 0, count = 1
  } = req.body || {}

  if (!wavespeedKey) return res.status(400).json({ error: 'WaveSpeed-Key fehlt (Settings)' })
  if (!prompt) return res.status(400).json({ error: 'Prompt fehlt' })

  // Resolve refImage to http URL if it's a data URL
  let refImageUrl = null
  try {
    if (refImage) {
      if (refImage.startsWith('http')) refImageUrl = refImage
      else if (refImage.startsWith('data:')) refImageUrl = await dataUrlToHttp(refImage)
    }
  } catch (e) {
    return res.status(500).json({ error: 'Reference-Upload fehlgeschlagen: ' + e.message })
  }

  // Pick endpoint based on count + resolution
  const resTier = resolution >= 4096 ? '4k' : resolution >= 2048 ? '2k' : '1k'
  const endpoint = resTier === '4k' ? ENDPOINT_ULTRA : (count > 1 ? ENDPOINT_MULTI : ENDPOINT)

  const body = {
    prompt,
    resolution: resTier,
    aspect_ratio: aspectRatio,
    output_format: format,
    seed: seed || -1
  }
  if (count > 1) body.num_images = count
  if (refImageUrl) body.images = [refImageUrl]
  if (format === 'jpeg' && typeof jpegQuality === 'number') body.quality = jpegQuality

  try {
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
      return res.status(submitRes.status).json({ error: `WaveSpeed submit ${submitRes.status}: ${t.slice(0, 300)}` })
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
        return res.status(200).json({ ok: true, urls: outputs, taskId, refImageUrl })
      }
      if (status === 'failed' || status === 'error') {
        return res.status(500).json({ error: 'Generation failed: ' + (poll.data?.error || 'unknown') })
      }
    }
    return res.status(504).json({ error: 'Timeout — Image-Gen dauert >55s.', taskId })
  } catch (e) {
    return res.status(500).json({ error: 'Fetch error: ' + (e.message || String(e)) })
  }
}
