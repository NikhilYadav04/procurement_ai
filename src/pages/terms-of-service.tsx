import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, FileText, Mail, AlertCircle } from 'lucide-react'

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service, Procurix</title>
        <meta name="description" content="Terms and conditions for using Procurix procurement platform" />
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
                <FileText className="h-6 w-6 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold text-foreground">Terms of Service</h1>
                <p className="text-sm text-muted-foreground mt-1"><strong>Effective Date:</strong> November 28, 2025</p>
              </div>
            </div>

            <div className="prose max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance</h2>
                <p className="text-muted-foreground">
                  By using Procurix, you agree to these Terms of Service. If you do not agree, do not use the platform.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground">
                  Procurix provides procurement automation tools including RFQ/RFP creation, vendor management, live auctions, reporting, and (optionally) Gmail-based email sending.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">3. Gmail Connection</h2>
                <p className="text-muted-foreground mb-3">Connecting Gmail is optional. When connected:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>We may send emails <strong>only when you explicitly initiate them</strong>.</li>
                  <li>We do not read, store, or analyze your Gmail inbox.</li>
                  <li>We comply with Google's Limited Use Policy.</li>
                  <li>You may disconnect or revoke permissions anytime.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">4. User Responsibilities</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Use Gmail sending tools responsibly</li>
                  <li>Do not spam vendors or misuse email services</li>
                  <li>Upload only legal and safe content</li>
                  <li>Keep your credentials secure</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Ownership</h2>
                <p className="text-muted-foreground">
                  You retain full ownership of your RFQs, RFPs, emails, vendor lists, and procurement documents.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">6. Prohibited Use</h2>
                <div className="rounded-[var(--radius-inner)] border border-border bg-sunken p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground mb-2">The following activities are strictly prohibited:</p>
                      <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                        <li>Spamming or unsolicited email campaigns</li>
                        <li>Phishing or impersonation</li>
                        <li>Reverse engineering or breaching platform security</li>
                        <li>Uploading harmful files</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">7. Termination</h2>
                <p className="text-muted-foreground">
                  We may suspend or terminate accounts involved in abuse, illegal procurement activity, or violation of these terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">8. Disclaimer</h2>
                <p className="text-muted-foreground">
                  The platform is provided "as-is." We are not responsible for procurement decisions or email outcomes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">9. Limitation of Liability</h2>
                <p className="text-muted-foreground">
                  We are not liable for indirect or incidental damages.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">10. Changes</h2>
                <p className="text-muted-foreground">
                  We may update these Terms. Continued use indicates acceptance.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">11. Contact</h2>
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
              Learn how we protect your data in our{' '}
              <Link href="/privacy-policy" className="text-primary hover:text-primary hover:underline font-medium">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
