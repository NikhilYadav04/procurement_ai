import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { withUser } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_LENGTH = 4000

export default withUser(async (req: NextApiRequest, res: NextApiResponse, sessionUser) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const message = String(req.body?.message || '').trim()

  if (!message) {
    return res.status(400).json({ success: false, error: 'Write something first.' })
  }

  if (message.length > MAX_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `That is ${message.length} characters. Please keep it under ${MAX_LENGTH}.`,
    })
  }

  const page = req.body?.page ? String(req.body.page).slice(0, 120) : null

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_email: sessionUser.email.toLowerCase(),
      user_name: sessionUser.name || null,
      message,
      page,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[FEEDBACK] Could not store feedback:', error.message)

    if (/relation .*feedback.* does not exist/i.test(error.message)) {
      return res.status(503).json({
        success: false,
        error: 'Feedback is not set up on this server yet. Run database/phase10-feedback.sql.',
      })
    }

    return res.status(500).json({ success: false, error: 'Could not save that. Please try again.' })
  }

  return res.status(200).json({ success: true, id: data?.id ?? null })
})
