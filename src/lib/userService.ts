import { supabaseAdmin as supabase } from './supabaseAdmin'

/**
 * User Service - Handles user profile operations
 */

export interface UserProfile {
  id: string
  google_id: string
  email: string
  name: string
  picture?: string
  email_verified: boolean
  role?: string
  industry?: string
  company_gstin?: string | null
  tax_rate_pct?: number | null
  bank_rate_pct?: number | null
  created_at: string
  updated_at: string
  last_login: string
}

/**
 * Get user profile by email
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('userprofile')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

/**
 * Get user profile by Google ID
 */
export async function getUserByGoogleId(googleId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('userprofile')
      .select('*')
      .eq('google_id', googleId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching user by Google ID:', error)
    return null
  }
}

/**
 * Create new user profile
 */
export async function createUser(userData: {
  google_id: string
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}): Promise<UserProfile | null> {
  try {
    const insertData = {
      google_id: userData.google_id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture || null,
      email_verified: userData.email_verified || false,
      last_login: new Date().toISOString(),
    }

    console.log('Inserting user data:', insertData)

    const { data, error } = await supabase
      .from('userprofile')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

/**
 * Update user profile
 */
export async function updateUser(
  email: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('userprofile')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error updating user:', error)
    return null
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(email: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('userprofile')
      .update({
        last_login: new Date().toISOString(),
      })
      .eq('email', email)

    if (error) throw error

    return true
  } catch (error) {
    console.error('Error updating last login:', error)
    return false
  }
}

/**
 * Get or create user
 */
export async function getOrCreateUser(userData: {
  google_id: string
  email: string
  name: string
  picture?: string
  email_verified?: boolean
}): Promise<UserProfile | null> {
  let user = await getUserByGoogleId(userData.google_id)
  
  if (!user) {
    user = await createUser(userData)
  } else {
    // Update last login
    await updateLastLogin(userData.email)
  }
  
  return user
}
