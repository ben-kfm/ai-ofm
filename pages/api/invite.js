// Invite endpoint — admin only.
// POST { email }    → adds email to allowed_users + sends a magic-link
// DELETE { email }  → removes email from allowed_users (cannot delete admins)
//
// Auth: client passes Supabase access token in Authorization: Bearer <token>.
// We verify with the service role client and check the caller's admin flag.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''

export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Supabase env vars fehlen' })
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify caller
  const { data: { user }, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

  // Check admin flag
  const { data: callerRow, error: callerErr } = await admin
    .from('allowed_users').select('is_admin').eq('email', user.email).maybeSingle()
  if (callerErr) return res.status(500).json({ error: callerErr.message })
  if (!callerRow?.is_admin) return res.status(403).json({ error: 'Admin-only' })

  const body = req.body || {}
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email ungültig' })

  if (req.method === 'POST') {
    // 1. Add to allowlist (idempotent)
    const { error: insErr } = await admin
      .from('allowed_users')
      .upsert({ email, invited_by: user.email, is_admin: false }, { onConflict: 'email' })
    if (insErr) return res.status(500).json({ error: insErr.message })

    // 2. Send magic link via Supabase SMTP
    // We use a non-admin client with anon key so signInWithOtp works correctly.
    const pub = createClient(SUPABASE_URL, ANON_KEY)
    const redirect = `${SITE_URL || `https://${req.headers.host}`}/auth/callback?next=/content-research`
    const { error: linkErr } = await pub.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect, shouldCreateUser: true }
    })
    if (linkErr) return res.status(500).json({ error: 'Mailversand fehlgeschlagen: ' + linkErr.message })

    return res.status(200).json({ ok: true, email })
  }

  // DELETE
  // Prevent deleting admins or self
  const { data: target } = await admin.from('allowed_users').select('is_admin').eq('email', email).maybeSingle()
  if (target?.is_admin) return res.status(403).json({ error: 'Admins können nicht entfernt werden' })
  if (email === user.email) return res.status(400).json({ error: 'Eigener Account' })

  const { error: delErr } = await admin.from('allowed_users').delete().eq('email', email)
  if (delErr) return res.status(500).json({ error: delErr.message })
  return res.status(200).json({ ok: true })
}
