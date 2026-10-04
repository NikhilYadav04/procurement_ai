import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, CreditCard, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import SideNav from '@/components/SideNav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createCheckout, VARIANT_IDS } from '@/lib/lemonsqueezy'
import { dur, ease } from '@/lib/motion'
import { formatNumber } from '@/lib/format'

interface UserSession {
  user: {
    id: string
    email: string
    name: string
    picture?: string
  }
  expiresAt: number
}

interface CustomerData {
  plan_name: string
  total_chat_credit: number
  total_doc_credit: number
  subscription_status: string
}

export default function SubscriptionPage() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [user, setUser] = useState<UserSession['user'] | null>(null)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const subscriptionPlans = [
    {
      id: 'topup',
      name: 'TopUp',
      price: 5,
      period: 'one-time',
      features: [
        '200 sourcing queries',
        '50 RFQ generations',
        'Standard support',
        '30-day validity'
      ],
      description: 'Perfect for occasional sourcing needs',
      cta: 'Purchase TopUp',
      popular: false,
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 20,
      period: '/month',
      features: [
        'Unlimited sourcing queries',
        'Unlimited RFQ generations',
        'Priority support',
        'Advanced analytics',
        'API access',
        'Custom integrations'
      ],
      description: 'Best for growing procurement teams',
      cta: 'Upgrade to Plus',
      popular: true,
    },
  ]

  useEffect(() => {
    try {
      const cookies = document.cookie.split(';')
      const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
      
      if (!sessionCookie) {
        router.push('/login')
        return
      }

      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
      setUser(sessionData.user)

      if (sessionData.user?.email) {
        fetchCustomerData(sessionData.user.email)
      }
    } catch (error) {
      console.error('Error loading session:', error)
      router.push('/login')
    }
  }, [router])

  const fetchCustomerData = async (email: string) => {
    try {
      const response = await fetch(`/api/customer/${encodeURIComponent(email)}`)
      if (response.ok) {
        const data = await response.json()
        setCustomerData(data)
      }
    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setCreditsLoading(false)
    }
  }

  const handlePurchase = async (planId: string) => {
    if (!user) return

    setSelectedPlan(planId)
    setCheckoutLoading(true)

    try {
      const variantId = planId === 'topup' ? VARIANT_IDS.TOPUP : VARIANT_IDS.PLUS

      const result = await createCheckout({
        variantId,
        email: user.email,
        name: user.name,
      })

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        throw new Error(result.error || 'Failed to create checkout')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Failed to start checkout', {
        description: 'Please try again or contact support'
      })
    } finally {
      setCheckoutLoading(false)
      setSelectedPlan('')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <Head>
        <title>Subscription - Procurix</title>
        <meta name="description" content="Choose your Procurix plan" />
      </Head>

      <div className="flex min-h-[100dvh] bg-background">
        <SideNav
          activePage="subscription"
          user={user}
          customerData={customerData || undefined}
          creditsLoading={creditsLoading}
          onLogout={handleLogout}
        />

        <main className="flex-1 md:ml-20 pb-20 md:pb-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-4 text-balance">
                Choose your plan
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Scale your procurement operations with flexible pricing.
              </p>
            </motion.div>

            {/* Current Plan */}
            {creditsLoading ? (
              <div className="mb-8 h-24 rounded-[var(--radius)] border border-border bg-secondary animate-pulse" aria-live="polite" aria-busy="true" />
            ) : customerData && (
              <motion.div
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.enter, ease: ease.standard }}
                className="mb-8"
              >
                <Card className="border border-primary/30 bg-accent">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Current plan</h3>
                        <p className="text-3xl font-semibold text-foreground capitalize">
                          {customerData.plan_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Credits available</p>
                        <p className="figure text-2xl font-semibold text-foreground">
                          {customerData.total_chat_credit === -1
                            ? '∞'
                            : formatNumber(customerData.total_chat_credit)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Plans */}
            <div className="grid md:grid-cols-2 gap-8">
              {subscriptionPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: Math.min(index, 5) * 0.032 }}
                >
                  <Card
                    className={`relative ${
                      plan.popular
                        ? 'border-2 border-primary/50'
                        : 'hover-lift'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground px-4 py-1 rounded-[var(--radius-inner)] text-sm font-semibold flex items-center gap-1">
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                          Most popular
                        </span>
                      </div>
                    )}

                    <CardHeader className="text-center pb-8 pt-10">
                      <CardTitle className="text-3xl mb-2">{plan.name}</CardTitle>
                      <div className="mb-4">
                        <span className="figure text-5xl font-semibold text-foreground">${formatNumber(plan.price)}</span>
                        <span className="text-xl text-muted-foreground">{plan.period}</span>
                      </div>
                      <CardDescription className="text-base">{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <ul className="space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="text-base">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => handlePurchase(plan.id)}
                        disabled={checkoutLoading}
                        variant={plan.popular ? "default" : "outline"}
                        size="lg"
                        className="w-full text-lg py-6"
                        aria-live="polite"
                      >
                        {checkoutLoading && selectedPlan === plan.id ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                            Loading…
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5 mr-2" aria-hidden="true" />
                            {plan.cta}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* FAQ or Additional Info */}
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: dur.enter, ease: ease.standard, delay: 0.128 }}
              className="mt-16 text-center"
            >
              <p className="text-muted-foreground">
                Need help choosing?{' '}
                <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                  <a href="mailto:support@procurixhq.com">Contact our team</a>
                </Button>
              </p>
            </motion.div>
          </div>
        </main>
      </div>
    </>
  )
}
