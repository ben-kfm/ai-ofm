// Image proxy — fetches Instagram CDN images server-side with browser headers
// to bypass hotlink protection / CORS. Returns the image bytes inline.
//
// Usage: <img src={`/api/img?url=${encodeURIComponent(it.displayUrl)}`} />

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).send('Missing url')
  // Only allow Instagram CDN hosts to prevent open proxy abuse
  try {
    const u = new URL(url)
    const allowed = ['cdninstagram.com', 'fbcdn.net', 'instagram.com']
    if (!allowed.some(host => u.hostname.endsWith(host))) {
      return res.status(400).send('Host not allowed')
    }
  } catch {
    return res.status(400).send('Invalid url')
  }

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (!r.ok) return res.status(r.status).send('Upstream ' + r.status)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg')
    const buf = Buffer.from(await r.arrayBuffer())
    res.send(buf)
  } catch (e) {
    return res.status(500).send('Fetch error: ' + (e.message || ''))
  }
}
