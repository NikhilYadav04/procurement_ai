import type { NextApiRequest, NextApiResponse } from 'next'
import { getOrCreateCustomer } from '@/lib/customerService'
import { withUser } from '@/lib/auth'

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const customer = await getOrCreateCustomer(user.email)

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    return res.status(200).json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
