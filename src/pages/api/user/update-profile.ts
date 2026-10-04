import type { NextApiRequest, NextApiResponse } from 'next'
import { updateUser, getUserByEmail } from '../../../lib/userService'
import { withUser } from '@/lib/auth'
import { checkGstin } from '@/lib/gstVerify'

type Update = Record<string, any>

function cleared(value: any) {
  return value === null || value === ''
}

function readRate(value: any, label: string): { error: string } | { value: number | null } {
  if (cleared(value)) return { value: null }

  const rate = Number(value)
  if (!Number.isFinite(rate)) return { error: `${label} must be a number.` }
  if (rate < 0 || rate > 100) return { error: `${label} must be between 0 and 100.` }

  return { value: Math.round(rate * 100) / 100 }
}

export function buildUpdate(body: any): { error: string } | { update: Update } {
  const update: Update = {}

  if (body.role !== undefined) {
    const role = String(body.role || '').trim()
    if (!role) return { error: 'Role cannot be blank.' }
    update.role = role
  }

  if (body.industry !== undefined) {
    const industry = String(body.industry || '').trim()
    if (!industry) return { error: 'Industry cannot be blank.' }
    update.industry = industry
  }

  if (body.tax_rate_pct !== undefined) {
    const rate = readRate(body.tax_rate_pct, 'The tax rate')
    if ('error' in rate) return rate
    update.tax_rate_pct = rate.value
  }

  if (body.bank_rate_pct !== undefined) {
    const rate = readRate(body.bank_rate_pct, 'The RBI bank rate')
    if ('error' in rate) return rate
    update.bank_rate_pct = rate.value
  }

  if (body.company_gstin !== undefined) {
    if (cleared(body.company_gstin)) {
      update.company_gstin = null
    } else {
      const check = checkGstin(String(body.company_gstin))
      if (!check.valid) return { error: check.reason || 'That GSTIN is not valid.' }
      update.company_gstin = check.gstin
    }
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update.' }

  return { update }
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, sessionUser) => {
  if (req.method === 'GET') {
    try {
      const user = await getUserByEmail(sessionUser.email)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      return res.status(200).json({
        success: true,
        data: user
      })
    } catch (error: any) {
      console.error('Error fetching user profile:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      })
    }
  }

  if (req.method === 'POST') {
    try {
      const built = buildUpdate(req.body || {})

      if ('error' in built) {
        return res.status(400).json({ success: false, error: built.error })
      }

      const user = await updateUser(sessionUser.email, built.update)

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Failed to update profile'
        })
      }

      return res.status(200).json({
        success: true,
        data: user
      })
    } catch (error: any) {
      console.error('Error updating user profile:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      })
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  })
})
