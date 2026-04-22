import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — TruckFlowUS',
  description:
    'TruckFlowUS Acceptable Use Policy outlining prohibited activities and enforcement on our platform.',
};

export default function AcceptableUsePolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-blue-600 font-bold text-lg">TruckFlowUS</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Acceptable Use Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 21, 2026</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Purpose</h2>
            <p>
              This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs the use of the TruckFlowUS
              platform (&ldquo;Service&rdquo;) and is incorporated into our{' '}
              <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>.
              It applies to all users, including dispatchers, drivers, brokers, and administrators.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Prohibited Activities</h2>
            <p>You may not use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Violate any local, state, federal, or international law or regulation</li>
              <li>Transmit fraudulent, misleading, or deceptive information</li>
              <li>Create fake accounts, driver profiles, or company records</li>
              <li>Submit false or fabricated tickets, invoices, payroll records, or trip sheets</li>
              <li>Impersonate another person, company, or entity</li>
              <li>Harass, threaten, or abuse other users through SMS or any platform feature</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or company data</li>
              <li>Upload viruses, malware, or any harmful code</li>
              <li>Scrape, crawl, or use automated tools to extract data from the Service</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Overload the Service with excessive automated requests or denial-of-service attacks</li>
              <li>Use the Service to send spam, unsolicited messages, or marketing communications
                  to phone numbers stored in the platform</li>
              <li>Circumvent or disable any security features, authentication controls, or
                  access restrictions</li>
              <li>Share account credentials with unauthorized individuals</li>
              <li>Use the platform for any purpose unrelated to trucking dispatch management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Content Standards</h2>
            <p>All content uploaded, entered, or transmitted through the Service must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Be accurate and truthful to the best of your knowledge</li>
              <li>Not contain offensive, discriminatory, or obscene material</li>
              <li>Not infringe on any third party&apos;s intellectual property rights</li>
              <li>Not contain personal information of individuals without their consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. SMS Usage</h2>
            <p>
              The SMS capabilities of the Service are provided for operational dispatch communications
              only. You may not use the SMS features to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Send messages unrelated to dispatch operations</li>
              <li>Send marketing or promotional messages</li>
              <li>Harass, threaten, or intimidate recipients</li>
              <li>Send messages to individuals who have not been legitimately added to the platform</li>
            </ul>
            <p className="mt-3">
              See our <Link href="/sms-terms" className="text-blue-600 underline">SMS Terms &amp; Consent</Link> page
              for additional messaging policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Account Security</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Keeping your login credentials, PINs, and access tokens confidential</li>
              <li>Ensuring only authorized personnel have access to your company&apos;s account</li>
              <li>Promptly reporting any suspected security breach to{' '}
                <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>
              </li>
              <li>Logging out of shared or public devices after use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Enforcement</h2>
            <p>
              We reserve the right to investigate and take action against any violations of this AUP,
              including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Issuing warnings to the account holder</li>
              <li>Temporarily suspending access to the Service</li>
              <li>Permanently terminating the account</li>
              <li>Removing or disabling content that violates this policy</li>
              <li>Reporting violations to law enforcement if required by law</li>
            </ul>
            <p className="mt-3">
              We may take these actions at our sole discretion and without prior notice where we
              determine it is necessary to protect the Service, its users, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Reporting Violations</h2>
            <p>
              If you become aware of any violation of this AUP, please report it to us at{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>.
              We take all reports seriously and will investigate promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this AUP from time to time. Changes will be posted on this page with an
              updated &ldquo;Last updated&rdquo; date. Continued use of the Service constitutes
              acceptance of any modifications.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          <Link href="/" className="text-blue-600 hover:underline">&larr; Back to TruckFlowUS</Link>
        </div>
      </div>
    </main>
  );
}
