import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEV_ENABLED, startDevSession } from '@/lib/dev/session';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || '/api/auth/google/callback'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Check if user is already logged in
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';')
      const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
      
      if (sessionCookie) {
        const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]))
        
        // Check if session is still valid
        if (sessionData.expiresAt > Date.now()) {
          // Redirect to dashboard if already logged in
          router.push('/dashboard')
        }
      }
    } catch (error) {
      // If there's an error parsing the session, just continue to login
      console.log('No valid session found')
    }
  }, [router])

  const handleGoogleLogin = () => {
    setIsLoading(true)

    const state = Math.random().toString(36).substring(7)
    sessionStorage.setItem('oauth_state', state)

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    googleAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    googleAuthUrl.searchParams.set('response_type', 'code')
    googleAuthUrl.searchParams.set('scope', 'openid email profile')
    googleAuthUrl.searchParams.set('state', state)

    window.location.href = googleAuthUrl.toString()
  }

  return (
    <>
      <Head>
        <title>Login - Procurix</title>
        <meta name="description" content="Sign in to Procurix with Google" />
      </Head>

      <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-background px-4 py-8"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[560px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[140px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_55%_50%_at_50%_50%,#000_35%,transparent_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <Image
              src="/procurixlogo_lightmode.png"
              alt="Procurix"
              width={36}
              height={36}
              className="object-contain"
            />
            <span className="text-xl font-semibold tracking-tight text-foreground">Procurix</span>
          </div>
          <div className="panel overflow-hidden">
            {/* Top section with Google logo and heading */}
            <div className="border-b border-border px-8 py-8">
              <div className="flex items-center gap-2 mb-4">
                {/* Google Logo */}
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="text-sm font-medium text-muted-foreground">Sign in with Google</span>
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">Welcome to Procurix</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sourcing, auctions and MSME compliance in one thread.
              </p>
            </div>

            {/* Main content area */}
            <div className="px-8 py-8">
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                size="lg"
                className="w-full active:scale-95"
                aria-live="polite"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Continue with Google</span>
                )}
              </Button>

              {/* Development harness. DEV_ENABLED is inlined by Next, so this
                  block does not exist in a production build. Signs in against
                  fixtures with no Supabase, Google or Gemini credentials. */}
              {DEV_ENABLED && (
                <button
                  type="button"
                  onClick={() => {
                    startDevSession();
                    window.location.href = '/dashboard';
                  }}
                  className="mt-3 w-full rounded-[var(--radius-inner)] border border-dashed border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Continue without a backend (development only)
                </button>
              )}

              {/* Footer text */}
              <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
                By signing in, you agree to our{' '}
                <a href="/terms-of-service" className="font-medium text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy-policy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
