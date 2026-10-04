import type { NextApiRequest, NextApiResponse } from 'next'
import { updateCustomerSubscription } from '@/lib/customerService'
import rawBody from 'raw-body'

// Disable body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

// Webhook variant IDs (numeric, different from checkout URL IDs)
const VARIANT_ID_TOPUP = process.env.LEMON_SQUEEZY_VARIANT_ID_TOPUP
const VARIANT_ID_PLUS = process.env.LEMON_SQUEEZY_VARIANT_ID_PLUS

interface WebhookPayload {
  meta: {
    event_name: string
    custom_data?: {
      user_email?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      customer_id: number
      order_id: number
      order_number: number
      variant_id: number
      variant_name: string
      product_name: string
      user_email: string
      user_name: string
      status: string
      total: number
      currency: string
      first_order_item: {
        id: number
        order_id: number
        product_id: number
        variant_id: number
        price: number
      }
      urls: {
        receipt: string
      }
      created_at: string
      updated_at: string
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get raw body for signature verification
    const body = await rawBody(req)
    const bodyString = body.toString('utf8')
    const payload: WebhookPayload = JSON.parse(bodyString)

    console.log('📥 Webhook received:', payload.meta.event_name)

    // Handle different webhook events
    const eventName = payload.meta.event_name

    if (eventName === 'order_created') {
      await handleOrderCreated(payload)
    } else if (eventName === 'subscription_created') {
      await handleSubscriptionCreated(payload)
    } else if (eventName === 'subscription_updated') {
      await handleSubscriptionUpdated(payload)
    } else if (eventName === 'subscription_cancelled') {
      await handleSubscriptionCancelled(payload)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

async function handleOrderCreated(payload: WebhookPayload) {
  const { attributes } = payload.data
  const variantId = attributes.first_order_item.variant_id.toString()
  const email = attributes.user_email

  console.log('📦 Order created:', {
    email,
    variantId,
    productName: attributes.variant_name,
  })

  // Determine plan based on variant ID
  let planName = 'free'
  if (variantId === VARIANT_ID_TOPUP) {
    planName = 'topup'
  } else if (variantId === VARIANT_ID_PLUS) {
    planName = 'plus'
  }

  // Update customer record
  await updateCustomerSubscription(email, {
    customer_id: attributes.customer_id.toString(),
    order_id: attributes.order_id.toString(),
    variant_id: variantId,
    plan_name: planName,
    subscription_status: 'active',
    amount_paid: attributes.total,
    currency: attributes.currency,
  } as any)

  console.log('✅ Customer updated:', email, 'Plan:', planName)
}

async function handleSubscriptionCreated(payload: WebhookPayload) {
  // Handle subscription creation
  const { attributes } = payload.data
  console.log('🔔 Subscription created:', attributes.user_email)
}

async function handleSubscriptionUpdated(payload: WebhookPayload) {
  // Handle subscription updates
  const { attributes } = payload.data
  console.log('🔄 Subscription updated:', attributes.user_email)
}

async function handleSubscriptionCancelled(payload: WebhookPayload) {
  // Handle subscription cancellation
  const { attributes } = payload.data
  const email = attributes.user_email

  await updateCustomerSubscription(email, {
    subscription_status: 'cancelled',
  } as any)

  console.log('❌ Subscription cancelled:', email)
}
