import { supabaseAdmin as supabase } from './supabaseAdmin'

/**
 * Customer Service - Handles all customer-related database operations
 */

export interface Customer {
  id: string
  email: string
  customer_id?: string
  order_id?: string
  variant_id?: string
  plan_name: string
  subscription_status: string
  billing_cycle?: string
  amount_paid?: number
  currency?: string
  monthly_chat_credit: number
  plan_chat_credit: number
  total_chat_credit: number
  monthly_doc_credit: number
  plan_doc_credit: number
  total_doc_credit: number
  renews_at?: string
  created_at: string
  updated_at: string
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No customer found, return null
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching customer:', error)
    return null
  }
}

/**
 * Create a new customer (default free tier)
 */
export async function createCustomer(email: string): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        email,
        plan_name: 'free',
        subscription_status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error creating customer:', error)
    return null
  }
}

/**
 * Update customer subscription
 */
export async function updateCustomerSubscription(
  email: string,
  data: Partial<Customer>
): Promise<Customer | null> {
  try {
    const { data: updated, error } = await supabase
      .from('customers')
      .update(data)
      .eq('email', email)
      .select()
      .single()

    if (error) throw error

    return updated
  } catch (error) {
    console.error('Error updating customer:', error)
    return null
  }
}

/**
 * Deduct credits from customer
 */
export async function deductCredits(
  email: string,
  type: 'chat' | 'doc'
): Promise<boolean> {
  try {
    const customer = await getCustomerByEmail(email)
    if (!customer) return false

    // Check if unlimited
    if (type === 'chat' && customer.plan_chat_credit === -1) return true
    if (type === 'doc' && customer.plan_doc_credit === -1) return true

    // Deduct from plan credits first, then monthly
    let updateData: any = {}

    if (type === 'chat') {
      if (customer.plan_chat_credit > 0) {
        updateData.plan_chat_credit = customer.plan_chat_credit - 1
      } else if (customer.monthly_chat_credit > 0) {
        updateData.monthly_chat_credit = customer.monthly_chat_credit - 1
      } else {
        return false // No credits available
      }
    } else {
      if (customer.plan_doc_credit > 0) {
        updateData.plan_doc_credit = customer.plan_doc_credit - 1
      } else if (customer.monthly_doc_credit > 0) {
        updateData.monthly_doc_credit = customer.monthly_doc_credit - 1
      } else {
        return false // No credits available
      }
    }

    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('email', email)

    if (error) throw error

    return true
  } catch (error) {
    console.error('Error deducting credits:', error)
    return false
  }
}

/**
 * Get or create customer
 */
export async function getOrCreateCustomer(email: string): Promise<Customer | null> {
  let customer = await getCustomerByEmail(email)
  if (!customer) {
    customer = await createCustomer(email)
  }
  return customer
}
