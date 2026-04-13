import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Tuscany Village Self Storage',
  description:
    'Privacy policy for Tuscany Village Self Storage. Learn how we collect, use, and protect your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-brown py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-cream/60">Last updated: April 13, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-brown leading-relaxed">
            <div>
              <p>
                Tuscany Village Self Storage (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
                operates the website at tuscanystorage.com and the associated tenant portal. This
                Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you visit our website or use our services.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Information We Collect
              </h2>
              <p className="mb-3">
                We may collect personal information that you voluntarily provide when you:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Reserve or rent a storage unit</li>
                <li>Create a tenant portal account</li>
                <li>Make a payment</li>
                <li>Contact us by phone, email, or through our website</li>
                <li>Join a waiting list</li>
              </ul>
              <p className="mt-3">
                This information may include your name, email address, phone number, mailing address,
                payment card details (processed securely through Stripe), and vehicle information for
                RV/boat storage.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                How We Use Your Information
              </h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Process your rental agreement and manage your account</li>
                <li>Process payments and send billing notifications</li>
                <li>Provide gate access codes and facility access</li>
                <li>Communicate with you about your unit, account status, and promotions</li>
                <li>Comply with legal obligations, including Tennessee lien laws</li>
                <li>Improve our website and services</li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect
                your personal information. All payment transactions are processed through Stripe,
                which is PCI DSS compliant. We do not store your full credit card number on our
                servers. However, no method of transmission over the Internet or electronic storage
                is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Cookies</h2>
              <p>
                Our website uses cookies and similar tracking technologies to enhance your browsing
                experience, remember your preferences, and maintain your login session. You can
                instruct your browser to refuse all cookies or to indicate when a cookie is being
                sent. However, if you do not accept cookies, some portions of our website may not
                function properly.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Third-Party Services
              </h2>
              <p className="mb-3">
                We use the following third-party services that may collect or process your data:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  <span className="font-semibold text-brown">Stripe</span> — for secure payment
                  processing. Stripe&apos;s privacy policy is available at{' '}
                  <a
                    href="https://stripe.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tan hover:underline"
                  >
                    stripe.com/privacy
                  </a>
                  .
                </li>
                <li>
                  <span className="font-semibold text-brown">Vercel</span> — for website hosting
                  and analytics.
                </li>
              </ul>
              <p className="mt-3">
                We do not sell, trade, or otherwise transfer your personal information to outside
                parties except as described in this policy.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as
                needed to provide you services. After you move out, we may retain certain information
                as required by law or for legitimate business purposes, such as resolving disputes or
                enforcing our agreements.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Your Rights</h2>
              <p>
                You may request access to, correction of, or deletion of your personal information
                by contacting us. We will respond to your request within a reasonable timeframe.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                changes by posting the new policy on this page and updating the &quot;Last
                updated&quot; date.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <ul className="mt-3 space-y-1 text-muted">
                <li>
                  Phone:{' '}
                  <a href="tel:+18654262100" className="text-tan hover:underline">
                    (865) 426-2100
                  </a>
                </li>
                <li>
                  Email:{' '}
                  <a href="mailto:Tuscanystorage@gmail.com" className="text-tan hover:underline">
                    Tuscanystorage@gmail.com
                  </a>
                </li>
                <li>Address: 2519 Highway 116, Caryville, TN 37714</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
