import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Shield, Mail } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy, Procurix</title>
        <meta name="description" content="Learn how Procurix collects, uses, and protects your data" />
      </Head>

      <div className="min-h-[100dvh] bg-background">
        {/* Header */}
        <div className="bg-surface/60 backdrop-blur-xl border-b border-border sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-[var(--radius-inner)] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Back to Login</span>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="rounded-[var(--radius)] border border-border bg-surface p-8 md:p-12">
            {/* Title Section */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-sunken">
                <Shield className="h-6 w-6 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold text-foreground">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground mt-1"><strong>Effective Date:</strong> November 28, 2025</p>
              </div>
            </div>

            <div className="prose max-w-none">
              <p className="text-muted-foreground leading-relaxed mb-8">
                Procurix ("we", "our", "us") provides procurement automation tools including RFQ/RFP management, vendor management, live auctioning, and analytics. This Privacy Policy explains how we collect, use, and protect your data.
              </p>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-muted-foreground mb-3">1.1 Google OAuth Login Data</h3>
                  <p className="text-muted-foreground mb-3">When you sign in through Google, we collect your:</p>
                  <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>Name</li>
                    <li>Email address</li>
                    <li>Profile picture (if available)</li>
                  </ul>
                  <p className="text-muted-foreground mt-3">No additional Google data is accessed unless you explicitly grant Gmail permissions.</p>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-muted-foreground mb-3">1.2 Gmail Integration (Optional)</h3>
                  <p className="text-muted-foreground mb-3">If you connect your Gmail account, we may request the following scopes:</p>
                  <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                    <li><strong>Send email on your behalf (gmail.send)</strong></li>
                    <li>View your basic email profile (email address)</li>
                  </ul>
                  <p className="text-muted-foreground mb-4">
                    These permissions allow Procurix to send RFQs, RFPs, vendor messages, and procurement communications that are <strong>explicitly initiated by you</strong>.
                  </p>
                  
                  <div className="bg-destructive/15 border border-destructive/40 rounded-lg p-4 mt-4">
                    <p className="font-semibold text-red-400 mb-2">We do NOT:</p>
                    <ul className="list-disc pl-6 space-y-1 text-red-400">
                      <li>Read your inbox</li>
                      <li>Store your emails</li>
                      <li>Access existing emails or threads</li>
                      <li>Analyze or share email contents</li>
                      <li>Use Gmail data for ads or marketing</li>
                    </ul>
                  </div>
                  
                  <p className="text-muted-foreground mt-4">
                    We comply with Google's API Services User Data Policy and Limited Use requirements.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">2. How We Use Your Information</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Authenticate your account</li>
                  <li>Enable user-initiated email sending via Gmail</li>
                  <li>Operate procurement workflows (RFQs, RFPs, auctions)</li>
                  <li>Provide analytics and reporting</li>
                  <li>Improve platform security and performance</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">3. Data Security</h2>
                <p className="text-muted-foreground">
                  We use HTTPS, encrypted storage, and access control. Gmail content is never stored or downloaded.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">4. Your Rights</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Disconnect Gmail at any time</li>
                  <li>Revoke OAuth access via Google Security Settings</li>
                  <li>Request deletion of your data</li>
                  <li>Delete your account</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">5. Cookies</h2>
                <p className="text-muted-foreground">
                  We use cookies for authentication and analytics.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">6. Third-Party Services</h2>
                <p className="text-muted-foreground">
                  We use Google OAuth, Gmail API, hosting platforms, and analytics providers.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">7. Updates</h2>
                <p className="text-muted-foreground">
                  We may update this policy occasionally. Continued use means you accept changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">8. Contact</h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-5 w-5 text-primary" />
                  <a href="mailto:support@procurixhq.com" className="text-primary hover:text-primary font-medium hover:underline">
                    support@procurixhq.com
                  </a>
                </div>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Have questions? Read our{' '}
              <Link href="/terms-of-service" className="text-primary hover:text-primary hover:underline font-medium">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
