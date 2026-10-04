import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, User, Sparkles, Network, Zap, Check } from 'lucide-react'
import { toast } from 'sonner'
import { dur, ease, spring, press } from '@/lib/motion'

/** Primary CTA with spring hover physics, per the motion spec. */
function PrimaryButton({
  children,
  onClick,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
}) {
  const shouldReduceMotion = useReducedMotion()
  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion ? undefined : press}
      transition={spring.ui}
      className={`flex items-center justify-center gap-2 rounded-[var(--radius-inner)] bg-primary font-semibold text-sm text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {children}
    </motion.button>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showFinalLoader, setShowFinalLoader] = useState(false)
  
  // User profile data
  const [userRole, setUserRole] = useState('')
  const [otherRole, setOtherRole] = useState('')
  const [userIndustry, setUserIndustry] = useState('')
  const [otherIndustry, setOtherIndustry] = useState('')

  // Check if user should be here and if onboarding is already completed
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const cookies = document.cookie.split(';')
        const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
        
        if (!sessionCookie) {
          router.push('/login')
          return
        }

        // Get user email from session
        const sessionValue = sessionCookie.split('=')[1]
        const sessionData = JSON.parse(decodeURIComponent(sessionValue))
        const userEmail = sessionData.user?.email

        if (userEmail) {
          // Check if user profile is complete in database
          const response = await fetch(`/api/user/update-profile?email=${encodeURIComponent(userEmail)}`)
          if (response.ok) {
            const result = await response.json()
            // If user has role and industry, onboarding is complete
            if (result.data?.role && result.data?.industry) {
              console.log('User already completed onboarding, redirecting to dashboard')
              router.push('/dashboard')
              return
            }
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // Don't redirect on error, let user complete onboarding
      }
    }

    checkOnboardingStatus()
  }, [router])

  const handleNext = async () => {
    if (currentStep === 1) {
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate
      if (!userRole || !userIndustry) {
        toast.error('Please complete your profile')
        return
      }
      if (userRole === 'other' && !otherRole.trim()) {
        toast.error('Please specify your role')
        return
      }
      if (userIndustry === 'other' && !otherIndustry.trim()) {
        toast.error('Please specify your industry')
        return
      }
      
      // Save profile
      const profileData = {
        role: userRole === 'other' ? otherRole : userRole,
        industry: userIndustry === 'other' ? otherIndustry : userIndustry,
      }
      
      try {
        const cookies = document.cookie.split(';')
        const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
        
        if (sessionCookie) {
          const sessionValue = sessionCookie.split('=')[1]
          const sessionData = JSON.parse(decodeURIComponent(sessionValue))
          
          const response = await fetch('/api/user/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: sessionData.user.email,
              role: profileData.role,
              industry: profileData.industry,
            }),
          })
          
          const result = await response.json()
          
          if (result.success) {
            toast.success('Profile saved.')
          }
        }
      } catch (error) {
        console.error('Error saving profile:', error)
      }
      
      startSetupProcess()
    }
  }

  const startSetupProcess = async () => {
    setIsLoading(true)
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    setIsLoading(false)
    setShowFinalLoader(true)
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    router.push('/dashboard')
  }

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Setting Up - Procurix</title>
        </Head>
        <div
          className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-4"
        >
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="text-center max-w-lg mx-auto"
          >
            <div className="mb-12">
              <div className="relative mx-auto w-24 h-24 rounded-[var(--radius)] flex items-center justify-center overflow-hidden border border-border bg-surface">
                <Image src="/procurixlogo_lightmode.png" alt="Procurix" width={64} height={64} className="object-contain" />
              </div>
            </div>

            <h2 className="text-3xl font-semibold text-foreground mb-4">
              Preparing your workspace…
            </h2>
            <p className="text-sm text-muted-foreground">
              This will only take a moment.
            </p>

            <div className="w-80 mx-auto mt-8">
              <div
                aria-hidden="true"
                className="h-2 rounded-[var(--radius-inner)] overflow-hidden bg-secondary"
              >
                <motion.div
                  className="h-full origin-left rounded-[var(--radius-inner)] bg-primary"
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 3, ease: 'linear' }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Welcome to Procurix</title>
        <meta name="description" content="Get started with Procurix" />
      </Head>

      {showFinalLoader && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-background"
        >
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="flex flex-col items-center gap-8"
          >
            <div
              aria-hidden="true"
              className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin"
            />
            <p className="text-lg font-semibold text-foreground">
              Taking you to your dashboard…
            </p>
          </motion.div>
        </div>
      )}

      <main
        className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4 py-8"
      >
        <div className="w-full max-w-sm">
          {/* Progress Indicator */}
          <div className="flex justify-center mb-6 gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={2} aria-label="Onboarding progress">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-[var(--radius-inner)] transition-[background-color,width] duration-300 ${
                  step === currentStep
                    ? 'w-8 bg-primary'
                    : step < currentStep
                    ? 'w-6 bg-primary/50'
                    : 'w-6 bg-secondary'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
                transition={{ duration: dur.enter, ease: ease.standard }}
              >
                <div
                  className="panel overflow-hidden"
                >
                  <div className="px-8 py-8 border-b border-border">
                    <div className="mx-auto mb-6 w-16 h-16 rounded-[var(--radius)] flex items-center justify-center overflow-hidden border border-border bg-surface">
                      <Image src="/procurixlogo_lightmode.png" alt="Procurix" width={48} height={48} className="object-contain" />
                    </div>

                    <div className="text-center space-y-2">
                      <h1 className="text-2xl font-bold text-foreground text-balance">
                        Welcome to Procurix
                      </h1>
                      <p className="text-sm font-medium text-muted-foreground">
                        AI-powered sourcing platform
                      </p>
                    </div>
                  </div>

                  <div className="px-8 py-6 space-y-3">
                    {[
                      {
                        icon: <Zap className="w-5 h-5" aria-hidden="true" />,
                        title: 'Automated live auctions',
                        desc: 'Host real-time reverse auctions with instant notifications.'
                      },
                      {
                        icon: <Network className="w-5 h-5" aria-hidden="true" />,
                        title: 'Automated RFP generation',
                        desc: 'Create professional RFPs in seconds with AI.'
                      },
                      {
                        icon: <Sparkles className="w-5 h-5" aria-hidden="true" />,
                        title: 'Live reverse auctions',
                        desc: 'Invite vendors and watch them bid the price down in real time.'
                      }
                    ].map((feature, idx) => (
                      <motion.div
                        key={idx}
                        className="panel p-4"
                        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: dur.enter, ease: ease.standard, delay: Math.min(idx, 5) * 0.032 }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary text-foreground"
                          >
                            {feature.icon}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1 text-foreground">
                              {feature.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {feature.desc}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    <PrimaryButton onClick={handleNext} className="w-full mt-6 py-3.5">
                      Get started
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </PrimaryButton>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
                transition={{ duration: dur.enter, ease: ease.standard }}
              >
                <div
                  className="panel overflow-hidden"
                >
                  <div className="px-8 py-6 border-b border-border">
                    <div className="mx-auto mb-6 w-16 h-16 rounded-[var(--radius)] flex items-center justify-center bg-primary">
                      <User className="w-8 h-8 text-primary-foreground" strokeWidth={1.5} aria-hidden="true" />
                    </div>

                    <div className="text-center space-y-2">
                      <h1 className="text-2xl font-bold text-foreground text-balance">
                        Tell us about you
                      </h1>
                      <p className="text-sm font-medium text-muted-foreground">
                        Personalize your experience.
                      </p>
                    </div>
                  </div>

                  <div className="px-8 py-6 space-y-5">
                    {/* Role Selection */}
                    <fieldset className="space-y-3 border-0 p-0 m-0 min-w-0">
                      <legend className="text-sm font-semibold text-foreground">
                        What describes you best?
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {['Procurement', 'Founder', 'Manager', 'Consultant', 'Other'].map((role) => {
                          const isSelected = userRole === role.toLowerCase()
                          return (
                            <motion.label
                              key={role}
                              className={`relative px-4 py-3 rounded-[var(--radius-inner)] text-sm font-medium border-2 cursor-pointer flex items-center justify-center gap-2 transition-[background-color,border-color,color] duration-150 peer-focus-visible:ring-2 ${
                                isSelected
                                  ? 'border-primary bg-primary/12 font-semibold text-primary'
                                  : 'border-border bg-secondary text-muted-foreground'
                              }`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={press}
                              transition={spring.ui}
                            >
                              <input
                                type="radio"
                                name="user-role"
                                className="peer absolute opacity-0"
                                checked={isSelected}
                                onChange={() => setUserRole(role.toLowerCase())}
                              />
                              {isSelected && <Check className="w-4 h-4" aria-hidden="true" />}
                              <span>{role}</span>
                            </motion.label>
                          )
                        })}
                      </div>

                      {userRole === 'other' && (
                        <div>
                          <label htmlFor="other-role" className="sr-only">
                            Your role
                          </label>
                          <input
                            id="other-role"
                            type="text"
                            autoComplete="off"
                            placeholder="Please specify your role…"
                            value={otherRole}
                            onChange={(e) => setOtherRole(e.target.value)}
                            className="w-full rounded-[var(--radius-inner)] border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </fieldset>

                    {/* Industry Selection */}
                    <fieldset className="space-y-3 border-0 p-0 m-0 min-w-0">
                      <legend className="text-sm font-semibold text-foreground">
                        Which industry?
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {['Manufacturing', 'Tech', 'Healthcare', 'Retail', 'Other'].map((industry) => {
                          const isSelected = userIndustry === industry.toLowerCase()
                          return (
                            <motion.label
                              key={industry}
                              className={`relative px-4 py-3 rounded-[var(--radius-inner)] text-sm font-medium border-2 cursor-pointer flex items-center justify-center gap-2 transition-[background-color,border-color,color] duration-150 peer-focus-visible:ring-2 ${
                                isSelected
                                  ? 'border-primary bg-primary/12 font-semibold text-primary'
                                  : 'border-border bg-secondary text-muted-foreground'
                              }`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={press}
                              transition={spring.ui}
                            >
                              <input
                                type="radio"
                                name="user-industry"
                                className="peer absolute opacity-0"
                                checked={isSelected}
                                onChange={() => setUserIndustry(industry.toLowerCase())}
                              />
                              {isSelected && <Check className="w-4 h-4" aria-hidden="true" />}
                              <span>{industry}</span>
                            </motion.label>
                          )
                        })}
                      </div>

                      {userIndustry === 'other' && (
                        <div>
                          <label htmlFor="other-industry" className="sr-only">
                            Your industry
                          </label>
                          <input
                            id="other-industry"
                            type="text"
                            autoComplete="off"
                            placeholder="Please specify your industry…"
                            value={otherIndustry}
                            onChange={(e) => setOtherIndustry(e.target.value)}
                            className="w-full rounded-[var(--radius-inner)] border border-border bg-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </fieldset>
                  </div>

                  <div className="px-8 py-6 border-t border-border flex justify-end">
                    <PrimaryButton onClick={handleNext} className="px-6 py-3">
                      Continue
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </PrimaryButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  )
}