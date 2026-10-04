import type { NextApiRequest, NextApiResponse } from 'next'
import { withUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const ALLOWED_HOSTS = [
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
]

function isAllowed(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { data, error } = await supabaseAdmin
    .from('userprofile')
    .select('picture')
    .eq('email', user.email)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: 'Could not read the profile.' })
  }

  const picture = data?.picture
  if (!picture || typeof picture !== 'string') {
    return res.status(404).json({ error: 'No picture available' })
  }

  if (!isAllowed(picture)) {
    return res.status(400).json({ error: 'The stored picture URL is not a permitted source.' })
  }

  try {
    const imageResponse = await fetch(picture)
    if (!imageResponse.ok) {
      return res.status(404).json({ error: 'Image not found' })
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'That URL did not return an image.' })
    }

    const imageBuffer = await imageResponse.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')

    return res.send(Buffer.from(imageBuffer))
  } catch {
    return res.status(502).json({ error: 'Could not fetch the picture.' })
  }
})
