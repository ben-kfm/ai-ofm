// WaveSpeed Seedance 2.0 — Image-to-Video generation
// POST { wavespeedKey, imageUrl, prompt, duration, resolution, aspectRatio, frameRate, direction, negativePrompt, seed }
// Returns: { ok, taskId } — frontend polls /api/wavespeed/poll for completion

export const config = { maxDuration: 60 }

const ENDPOINT = 'https://api.wavespeed.ai/api/v3/bytedance/seedance-2.0/image-to-video'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const {
    wavespeedKey, imageUrl, prompt = '',
    duration = 5, resolution = '720p',
    aspectRatio = '9:16', frameRate = 24,
    direction = '', negativePrompt = '',
    seed = -1, generateAudio = false, cameraFixed = false
  } = req.body || {}

  if (!wavespeedKey) return res.status(400).json({ error: 'WaveSpeed-Key fehlt (Settings)' })
  if (!imageUrl) return res.status(400).json({ error: 'Image-URL fehlt' })

  const fullPrompt = [prompt, direction].filter(Boolean).join('. ')

  const body = {
    image: imageUrl,
    prompt: fullPrompt || 'subtle natural motion, breathing, soft camera idle',
    duration: Number(duration) || 5,
    resolution,
    aspect_ratio: aspectRatio,
    fps: Number(frameRate) || 24,
    seed: Number(seed) || -1,
    generate_audio: !!generateAudio,
    camera_fixed: !!cameraFixed
  }
  if (negativePrompt) body.negative_prompt = negativePrompt

  try {
    const submitRes = await fetch(ENDPOINT, {
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

    return res.status(200).json({ ok: true, taskId })
  } catch (e) {
    return res.status(500).json({ error: 'Fetch error: ' + (e.message || String(e)) })
  }
}
