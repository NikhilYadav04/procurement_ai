/**
 * Lemon Squeezy Payment Integration Utilities
 * Procurix - Premium AI Sourcing Agent
 */

// Environment configuration
const STORE_ID = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_ID || ''
const API_KEY = process.env.LEMON_SQUEEZY_API_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const STORE_DOMAIN = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_DOMAIN || 'checkout.lemonsqueezy.com'

// Variant IDs for different plans
export const VARIANT_IDS = {
  TOPUP: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_TOPUP_URL || '',
  PLUS: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_PLUS_URL || '',
}

// Check if Lemon Squeezy is properly configured
export const isLemonSqueezyConfigured = () => {
  return !!(STORE_ID && VARIANT_IDS.TOPUP && VARIANT_IDS.PLUS)
}

// Checkout configuration interface
export interface CheckoutConfig {
  variantId: string
  email?: string
  name?: string
  customData?: Record<string, any>
}

// Checkout response interface
export interface CheckoutResponse {
  success: boolean
  checkoutUrl?: string
  error?: string
}

/**
 * Create a Lemon Squeezy checkout session
 */
export async function createCheckout(config: CheckoutConfig): Promise<CheckoutResponse> {
  const { variantId, email, name, customData } = config

  if (!isLemonSqueezyConfigured()) {
    console.error('❌ Lemon Squeezy is not configured. Check your environment variables.')
    return {
      success: false,
      error: 'Payment system not configured. Please contact support.',
    }
  }

  if (!variantId) {
    return {
      success: false,
      error: 'Product variant not specified.',
    }
  }

  try {
    const baseUrl = `https://${STORE_DOMAIN}/buy/${variantId}`
    const checkoutUrl = new URL(baseUrl)
    
    // Add checkout options
    checkoutUrl.searchParams.set('embed', '1')
    checkoutUrl.searchParams.set('media', '0')
    checkoutUrl.searchParams.set('logo', '0')
    
    // Add customer information if provided
    if (email) {
      checkoutUrl.searchParams.set('checkout[email]', email)
    }
    if (name) {
      checkoutUrl.searchParams.set('checkout[name]', name)
    }
    
    // Add custom data for webhook processing
    if (customData) {
      checkoutUrl.searchParams.set('checkout[custom][data]', JSON.stringify(customData))
    }
    
    // Add success redirect
    checkoutUrl.searchParams.set('checkout[custom][success_url]', `${APP_URL}/`)
    
    return {
      success: true,
      checkoutUrl: checkoutUrl.toString(),
    }
  } catch (error) {
    console.error('Error creating checkout:', error)
    return {
      success: false,
      error: 'Failed to create checkout session.',
    }
  }
}

/**
 * Open Lemon Squeezy checkout overlay
 */
export function openCheckoutOverlay(checkoutUrl: string) {
  if (typeof window === 'undefined') return

  // Create overlay script
  const script = document.createElement('script')
  script.src = 'https://app.lemonsqueezy.com/js/lemon.js'
  script.async = true
  script.onload = () => {
    // @ts-ignore - LemonSqueezy global
    if (window.LemonSqueezy) {
      // @ts-ignore
      window.LemonSqueezy.Url.Open(checkoutUrl)
    }
  }
  
  document.head.appendChild(script)
}

/**
 * Get plan details by variant ID
 */
export function getPlanByVariantId(variantId: string) {
  if (variantId === VARIANT_IDS.TOPUP) {
    return {
      name: 'TopUp',
      type: 'topup',
      price: 5,
      chatCredits: 200,
      docCredits: 50,
    }
  } else if (variantId === VARIANT_IDS.PLUS) {
    return {
      name: 'Plus',
      type: 'plus',
      price: 20,
      chatCredits: -1,
      docCredits: -1,
    }
  }
  return null
}
