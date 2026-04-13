import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Tuscany Village Self Storage',
  description:
    'Terms of service for Tuscany Village Self Storage. Read the terms and conditions for renting a storage unit.',
}

export default function TermsOfServicePage() {
  return (
    <>
      {/* Header */}
      <section className="bg-brown py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-cream/60">Last updated: April 13, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-brown leading-relaxed">
            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Acceptance of Terms
              </h2>
              <p>
                By accessing or using the Tuscany Village Self Storage website at tuscanystorage.com,
                tenant portal, or any of our services, you agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use our services. These
                terms apply to all visitors, tenants, and users of the site and services.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Storage Services</h2>
              <p className="mb-3">
                Tuscany Village Self Storage provides self-storage units and vehicle storage spaces
                at our facility located at 2519 Highway 116, Caryville, TN 37714. Our services
                include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Rental of storage units on a month-to-month basis</li>
                <li>Open-air boat, RV, camper, and trailer storage</li>
                <li>24/7 electronic gate access for active tenants</li>
                <li>Online account management through the tenant portal</li>
              </ul>
              <p className="mt-3">
                You agree to use your storage unit only for lawful purposes. You may not store
                hazardous materials, flammable substances, explosives, illegal items, perishable
                goods, or any items prohibited by law or your rental agreement.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Rental Agreement
              </h2>
              <p>
                Your use of a storage unit is governed by the rental agreement (lease) you sign at
                move-in. These Terms of Service supplement but do not replace your rental agreement.
                In the event of a conflict between these terms and your signed rental agreement, the
                rental agreement shall prevail.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Payment Terms</h2>
              <p className="mb-3">
                Rent is due on the first day of each month. By using our services, you agree to the
                following payment terms:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>All payments are processed securely through Stripe</li>
                <li>
                  A security deposit equal to one month&apos;s rent is required at move-in and is
                  refundable upon move-out in good standing
                </li>
                <li>
                  Late fees may be assessed for payments not received by the due date, as specified
                  in your rental agreement
                </li>
                <li>
                  We reserve the right to place a lien on stored property for unpaid rent in
                  accordance with Tennessee Self-Service Storage Facility Act (T.C.A. 66-31-101 et
                  seq.)
                </li>
                <li>
                  Autopay enrollment is available and recommended to avoid late fees
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Access and Security
              </h2>
              <p>
                Active tenants receive a personalized gate access code. You are responsible for
                keeping your gate code confidential. You may not share your gate code with
                unauthorized individuals. We reserve the right to change or deactivate gate codes at
                any time for security purposes. Gate access may be restricted if your account is past
                due.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Limitation of Liability
              </h2>
              <p className="mb-3">
                Tuscany Village Self Storage provides self-storage space only. To the fullest extent
                permitted by law:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  We are not liable for loss, theft, or damage to your stored property from any
                  cause, including but not limited to fire, flood, water damage, weather, insects,
                  rodents, or acts of third parties
                </li>
                <li>
                  We strongly recommend that you maintain insurance coverage for your stored
                  belongings through your own renter&apos;s or homeowner&apos;s insurance policy
                </li>
                <li>
                  Our total liability to you for any claim arising from the use of our services
                  shall not exceed the total rent paid by you in the preceding 12 months
                </li>
                <li>
                  We are not liable for any indirect, incidental, special, or consequential damages
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Website and Portal Use
              </h2>
              <p>
                You agree not to misuse our website or tenant portal. This includes attempting to
                gain unauthorized access to any part of the site, interfering with the proper
                functioning of the site, or using the site for any fraudulent or unlawful purpose.
                We reserve the right to suspend or terminate your portal access if you violate these
                terms.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Termination</h2>
              <p>
                Either party may terminate the rental on a month-to-month basis by providing at
                least 30 days&apos; written notice prior to the end of the rental period. Upon
                termination, you must remove all belongings and leave the unit in the same condition
                as when you took possession, ordinary wear and tear excepted. Failure to vacate the
                unit after termination may result in additional charges and enforcement of lien
                rights under Tennessee law.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Governing Law</h2>
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws
                of the State of Tennessee, without regard to its conflict of law provisions. Any
                disputes arising under these terms shall be subject to the exclusive jurisdiction of
                the courts of Campbell County, Tennessee.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Changes to These Terms
              </h2>
              <p>
                We reserve the right to modify these Terms of Service at any time. Changes will be
                effective immediately upon posting to this page. Your continued use of our services
                after any changes constitutes your acceptance of the updated terms.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Contact Us</h2>
              <p>
                If you have questions about these Terms of Service, please contact us:
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
