import type { NextApiRequest, NextApiResponse } from 'next'
import { deductCredits } from '@/lib/customerService'
import { withUser } from '@/lib/auth'

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type } = req.body

  if (type !== 'chat' && type !== 'doc') {
    return res.status(400).json({ error: 'Invalid credit type' })
  }

  try {
    const success = await deductCredits(user.email, type)

    if (!success) {
      return res.status(400).json({ error: 'Insufficient credits' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error deducting credits:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
