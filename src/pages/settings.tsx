import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { User, Send, Mail, Building, Briefcase, Check, Shield, Globe, Scale, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import SideNav from '@/components/SideNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dur, ease } from '@/lib/motion'

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

interface UserProfile {
  role?: string
  industry?: string
  company_gstin?: string | null
  tax_rate_pct?: number | null
  bank_rate_pct?: number | null
}

const DEFAULT_TAX_RATE = 25
const DEFAULT_BANK_RATE = 6.5

interface IntegrationStatus {
  gmail: {
    connected: boolean
    connectedAt: string | null
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [user, setUser] = useState<UserSession['user'] | null>(null)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [taxRate, setTaxRate] = useState('')
  const [bankRate, setBankRate] = useState('')
  const [gstin, setGstin] = useState('')
  const [savingCompliance, setSavingCompliance] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const loadSession = async () => {
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
          fetchUserProfile(sessionData.user.email)
        }
        
        if (sessionData.user?.id) {
          fetchIntegrationStatus(sessionData.user.id)
        }
      } catch (error) {
        console.error('Error loading session:', error)
        router.push('/login')
      }
    }

    loadSession()
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
    }
  }

  const fetchUserProfile = async (email: string) => {
    try {
      const response = await fetch(`/api/user/update-profile?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setUserProfile({
            role: result.data.role,
            industry: result.data.industry,
            company_gstin: result.data.company_gstin ?? null,
            tax_rate_pct: result.data.tax_rate_pct ?? null,
            bank_rate_pct: result.data.bank_rate_pct ?? null
          })
          setTaxRate(result.data.tax_rate_pct == null ? '' : String(result.data.tax_rate_pct))
          setBankRate(result.data.bank_rate_pct == null ? '' : String(result.data.bank_rate_pct))
          setGstin(result.data.company_gstin ?? '')
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchIntegrationStatus = async (userId: string) => {
    try {
      const response = await fetch('/api/integrations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data)
      }
    } catch (error) {
      console.error('Error fetching integration status:', error)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      toast.error('Please enter your feedback')
      return
    }

    setSubmittingFeedback(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedback, page: 'settings' })
      })
      const result = await response.json()

      if (result.success) {
        toast.success('Thank you. Your feedback is saved.')
        setFeedback('')
      } else {
        toast.error(result.error || 'Failed to submit feedback')
      }
    } catch (error) {
      toast.error('Failed to submit feedback')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const effectiveInterest = (() => {
    const rate = bankRate.trim() === '' ? DEFAULT_BANK_RATE : Number(bankRate)
    if (!Number.isFinite(rate) || rate < 0) return '—'
    return String(Math.round(rate * 3 * 100) / 100)
  })()

  const handleSaveCompliance = async () => {
    setSavingCompliance(true)
    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_rate_pct: taxRate.trim() === '' ? null : taxRate.trim(),
          bank_rate_pct: bankRate.trim() === '' ? null : bankRate.trim(),
          company_gstin: gstin.trim() === '' ? null : gstin.trim()
        })
      })
      const result = await response.json()

      if (result.success) {
        setUserProfile(prev => ({
          ...prev,
          company_gstin: result.data.company_gstin ?? null,
          tax_rate_pct: result.data.tax_rate_pct ?? null,
          bank_rate_pct: result.data.bank_rate_pct ?? null
        }))
        setGstin(result.data.company_gstin ?? '')
        toast.success('Saved. Your compliance figures now use these.')
      } else {
        toast.error(result.error || 'Could not save those settings')
      }
    } catch (error) {
      toast.error('Could not save those settings')
    } finally {
      setSavingCompliance(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Could not log you out. Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <>
      <Head>
        <title>Settings - Procurix</title>
      </Head>

      <div className="flex min-h-[100dvh] bg-background">
        <SideNav
          activePage="settings"
          user={user}
          customerData={customerData || undefined}
          onLogout={handleLogout}
        />

        <main className="flex-1 md:ml-20 pb-20 md:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
              className="mb-10"
            >
              <h1 className="text-4xl font-semibold text-foreground mb-2 text-balance">Settings</h1>
              <p className="text-base text-muted-foreground">Manage your account, preferences, and integrations.</p>
            </motion.div>

            {!user ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" aria-live="polite" aria-busy="true">
                <div className="lg:col-span-2 space-y-8">
                  <div className="h-40 rounded-[var(--radius)] border border-border bg-secondary animate-pulse" />
                  <div className="h-56 rounded-[var(--radius)] border border-border bg-secondary animate-pulse" />
                </div>
                <div className="space-y-8">
                  <div className="h-64 rounded-[var(--radius)] border border-border bg-secondary animate-pulse" />
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Profile & Preferences */}
              <div className="lg:col-span-2 space-y-8">

                {/* Profile Card */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: 0.032 }}
                >
                  <Card className="panel overflow-hidden border-none">
                    <CardContent className="pt-8 pb-8 px-8">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                        <div className="relative flex-shrink-0">
                          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-border bg-secondary">
                            {user?.picture ? (
                              <Image
                                src={user.picture}
                                alt={user.name ?? 'Your profile picture'}
                                width={96}
                                height={96}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <User className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h2 className="text-2xl font-semibold text-foreground mb-1">{user?.name}</h2>
                          <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                        <div className="rounded-[var(--radius-inner)] border border-border bg-secondary p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-[var(--radius-inner)] bg-surface text-foreground border border-border">
                              <Briefcase className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</span>
                          </div>
                          <p className="text-base font-semibold text-foreground capitalize">
                            {userProfile?.role || <span className="text-muted-foreground">Not set</span>}
                          </p>
                        </div>
                        <div className="rounded-[var(--radius-inner)] border border-border bg-secondary p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-[var(--radius-inner)] bg-surface text-foreground border border-border">
                              <Building className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</span>
                          </div>
                          <p className="text-base font-semibold text-foreground capitalize">
                            {userProfile?.industry || <span className="text-muted-foreground">Not set</span>}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Compliance Card */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: 0.048 }}
                >
                  <Card className="border-none bg-surface">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="p-2 rounded-[var(--radius-inner)] bg-secondary text-foreground border border-border">
                          <Scale className="w-5 h-5" aria-hidden="true" />
                        </div>
                        Compliance
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        These three settings drive every rupee shown on the Compliance page.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="taxRate" className="mb-1.5 block text-sm font-medium text-foreground">
                            Your tax rate
                          </label>
                          <div className="relative">
                            <Input
                              id="taxRate"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.5}
                              value={taxRate}
                              onChange={(e) => setTaxRate(e.target.value)}
                              placeholder={String(DEFAULT_TAX_RATE)}
                              className="pr-8"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            How much of a late payment you lose as deduction this year. Blank uses {DEFAULT_TAX_RATE}%.
                          </p>
                        </div>

                        <div>
                          <label htmlFor="bankRate" className="mb-1.5 block text-sm font-medium text-foreground">
                            RBI bank rate
                          </label>
                          <div className="relative">
                            <Input
                              id="bankRate"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.05}
                              value={bankRate}
                              onChange={(e) => setBankRate(e.target.value)}
                              placeholder={String(DEFAULT_BANK_RATE)}
                              className="pr-8"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Section 16 charges three times this, compounded monthly &mdash; {effectiveInterest}% a year on what you owe late.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="gstin" className="mb-1.5 block text-sm font-medium text-foreground">
                          Your company GSTIN
                        </label>
                        <Input
                          id="gstin"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value.toUpperCase())}
                          placeholder="27AAPFU0939F1ZV"
                          maxLength={15}
                          spellCheck={false}
                          className="font-mono tracking-wide"
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Form MSME-1 is a companies-only return. Without your GSTIN we cannot tell whether it applies to you.
                        </p>
                      </div>

                      <Button
                        onClick={handleSaveCompliance}
                        disabled={savingCompliance}
                        className="font-semibold text-sm"
                        aria-live="polite"
                      >
                        {savingCompliance ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                            Saving&hellip;
                          </>
                        ) : (
                          'Save compliance settings'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Integrations Card */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: 0.064 }}
                >
                  <Card className="border-none bg-surface">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="p-2 rounded-[var(--radius-inner)] bg-secondary text-foreground border border-border">
                          <Globe className="w-5 h-5" aria-hidden="true" />
                        </div>
                        Connected integrations
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Manage your connected services and tools.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-[var(--radius-inner)] border border-border bg-surface hover:bg-secondary transition-colors duration-150">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[var(--radius-inner)] bg-secondary flex items-center justify-center border border-border">
                              <Mail className="w-5 h-5 text-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">Gmail</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {integrations?.gmail.connected
                                  ? 'Connected for email automation.'
                                  : 'Connect to automate emails.'}
                              </p>
                            </div>
                          </div>
                          {integrations?.gmail.connected ? (
                            <Badge className="bg-secondary text-foreground hover:bg-secondary border border-border px-2.5 py-1 text-xs font-semibold">
                              <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-border text-xs font-semibold">
                              Not connected
                            </Badge>
                          )}
                        </div>

                        {/* Placeholder for future integrations */}
                        <div className="flex items-center justify-between p-4 rounded-[var(--radius-inner)] border border-border bg-secondary opacity-50 cursor-not-allowed">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[var(--radius-inner)] bg-secondary flex items-center justify-center border border-border">
                              <Shield className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">Outlook</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">Coming soon.</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-secondary text-muted-foreground text-xs font-semibold">Coming soon</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Right Column: Feedback & Other */}
              <div className="space-y-8">
                {/* Feedback Card */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: 0.096 }}
                >
                  <Card className="border-none bg-surface h-full">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground">Send feedback</CardTitle>
                      <CardDescription className="text-muted-foreground">Help us improve your experience.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label htmlFor="feedback" className="mb-1.5 block text-sm font-medium text-foreground">
                          Your feedback
                        </label>
                        <Textarea
                          id="feedback"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Share your thoughts, suggestions, or report issues…"
                          className="min-h-[180px] resize-none"
                        />
                      </div>
                      <Button
                        onClick={handleSubmitFeedback}
                        disabled={submittingFeedback || !feedback.trim()}
                        className="w-full disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                        aria-live="polite"
                      >
                        {submittingFeedback ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                            Submitting…
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                            Submit feedback
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Sign out */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.enter, ease: ease.standard, delay: 0.128 }}
                >
                  <Card className="border-none bg-surface">
                    <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Signed in</p>
                        <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        aria-live="polite"
                        className="shrink-0 font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        {loggingOut ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                            Logging out&hellip;
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                            Log out
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Version Info */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Procurix v1.0.0
                  </p>
                  <div className="flex justify-center gap-3 mt-3 text-xs text-muted-foreground">
                    <Button variant="link" size="sm" onClick={() => router.push('/privacy-policy')} className="h-auto p-0 text-inherit hover:text-primary">Privacy policy</Button>
                    <span className="text-muted-foreground" aria-hidden="true">·</span>
                    <Button variant="link" size="sm" onClick={() => router.push('/terms-of-service')} className="h-auto p-0 text-inherit hover:text-primary">Terms of service</Button>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
