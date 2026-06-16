import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accessibility Statement | Tuscany Village Self Storage',
  description:
    'Accessibility statement for Tuscany Village Self Storage. Learn about our commitment to digital accessibility, our conformance with WCAG 2.1 Level AA, and how to report accessibility barriers.',
}

export default function AccessibilityStatementPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-brown py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Accessibility Statement
          </h1>
          <p className="mt-4 text-cream/60">Last reviewed: June 16, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-brown leading-relaxed">
            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Our Commitment</h2>
              <p>
                Tuscany Village Self-Storage Inc., doing business as Tuscany Village Self Storage
                (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), is committed to ensuring
                digital accessibility for people with disabilities. We believe everyone should be
                able to reserve a unit, manage their account, and access information about our
                facility regardless of ability. We are continually improving the user experience for
                everyone and applying the relevant accessibility standards to our website and tenant
                portal.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Conformance Status</h2>
              <p className="mb-3">
                The Web Content Accessibility Guidelines (WCAG) define requirements for designers and
                developers to improve accessibility for people with disabilities. Our website and
                tenant portal <strong>aim to conform to WCAG 2.1 Level AA</strong>.
              </p>
              <p>
                At this time, the site is <strong>partially conformant</strong> with WCAG 2.1 Level
                AA. &ldquo;Partially conformant&rdquo; means that some parts of the content may not
                yet fully meet the accessibility standard. We do not claim full conformance, and no
                official accessibility certification exists for websites; we describe our status
                honestly and work to close any gaps as we find them.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Measures We Take to Support Accessibility
              </h2>
              <p className="mb-3">
                We take the following measures to make our website and tenant portal more accessible:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Using semantic HTML so content structure is clear to assistive technologies</li>
                <li>Supporting keyboard navigation for interactive elements</li>
                <li>Providing text alternatives (alt text) for meaningful images</li>
                <li>Maintaining sufficient color contrast for text and interface elements</li>
                <li>Using ARIA attributes where native HTML is not sufficient</li>
                <li>
                  Running automated accessibility tests with axe-core as part of our development
                  process
                </li>
                <li>Considering accessibility in our design and development decisions</li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Feedback &amp; Reporting a Barrier
              </h2>
              <p className="mb-3">
                We welcome your feedback on the accessibility of our website. If you encounter an
                accessibility barrier, or need information on this site in a different format, please
                let us know:
              </p>
              <ul className="mt-3 space-y-1 text-muted">
                <li>
                  Email:{' '}
                  <a href="mailto:tuscanystorage@gmail.com" className="text-tan hover:underline">
                    tuscanystorage@gmail.com
                  </a>
                </li>
                <li>
                  Phone:{' '}
                  <a href="tel:+18654262100" className="text-tan hover:underline">
                    (865) 426-2100
                  </a>
                </li>
              </ul>
              <p className="mt-3">
                When reporting an issue, please include the web address (URL) of the page and a
                description of the problem so we can reproduce it. We aim to respond to accessibility
                feedback within 5 business days.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">
                Compatibility with Browsers and Assistive Technology
              </h2>
              <p className="mb-3">
                Our website is designed to be compatible with recent versions of the following:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Modern web browsers, including Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge</li>
                <li>Screen readers, including NVDA, JAWS, and VoiceOver</li>
                <li>Operating system and browser zoom and text-resizing features</li>
                <li>Keyboard-only navigation</li>
              </ul>
              <p className="mt-3">
                The site may not display or function as intended in older or unsupported browsers and
                assistive technologies.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Known Limitations</h2>
              <p className="mb-3">
                Despite our best efforts to ensure accessibility, some content may have limitations.
                Below is a list of known limitations, along with potential solutions. Please contact
                us if you encounter an issue that is not listed here.
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>No known limitations at this time.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Assessment Approach</h2>
              <p className="mb-3">
                We assessed the accessibility of this website using the following approaches:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  Self-evaluation, including automated testing with axe-core and manual checks for
                  keyboard navigation, heading structure, and color contrast
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-brown mb-4">Date</h2>
              <p>
                This statement was last reviewed on June 16, 2026. We review and update it
                periodically as our website and accessibility practices evolve.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
