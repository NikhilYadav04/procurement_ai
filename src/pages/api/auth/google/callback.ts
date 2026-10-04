import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getOrCreateUser, updateLastLogin } from '@/lib/userService'
import { getOrCreateCustomer } from '@/lib/customerService'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!
const JWT_SECRET = process.env.JWT_SECRET!

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token: string
}

interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state, error: oauthError } = req.query

  // Handle OAuth errors
  if (oauthError) {
    console.error('OAuth error:', oauthError)
    return res.redirect(`/login?error=${oauthError}`)
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/login?error=no_code')
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set, refusing to mint a session')
    return res.redirect('/login?error=server_misconfigured')
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token')
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json()

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info')
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json()

    console.log('Google user info received:', {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
    })

    // Create or update user in database
    const user = await getOrCreateUser({
      google_id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      email_verified: userInfo.verified_email,
    })

    if (!user) {
      throw new Error('Failed to create or get user')
    }

    // Create or get customer record (for credits)
    await getOrCreateCustomer(userInfo.email)

    // Create session token
    const sessionToken = jwt.sign(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Set session cookie - Remove HttpOnly so JavaScript can read it
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    const sessionData = {
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      expiresAt,
    }

    res.setHeader(
      'Set-Cookie',
      `session=${encodeURIComponent(JSON.stringify(sessionData))}; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    )

    // Check if onboarding is completed - user has both role and industry
    const onboardingComplete = user.role && user.industry;
    
    if (!onboardingComplete) {
      // Redirect to welcome/onboarding
      console.log('✅ Redirecting to /welcome (onboarding needed)')
      return res.redirect('/welcome')
    }

    // Redirect to dashboard - onboarding is complete
    console.log('✅ Redirecting to /dashboard (onboarding complete)')
    return res.redirect('/dashboard')
  } catch (error) {
    console.error('Authentication error:', error)
    return res.redirect('/login?error=authentication_failed')
  }
}
