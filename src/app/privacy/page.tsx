import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — TruckFlowUS',
  description:
    'TruckFlowUS Privacy Policy describing how we collect, use, store, and protect your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-blue-600 font-bold text-lg">TruckFlowUS</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 21, 2026</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              TruckFlowUS (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
              is committed to protecting the privacy of our users. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use the TruckFlowUS
              platform (&ldquo;Service&rdquo;).
            </p>
            <p className="mt-3">
              By using the Service, you agree to the collection and use of information in accordance
              with this Privacy Policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="font-medium text-gray-900 mb-2">Information you provide directly:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Account registration data (name, email address, company name, password)</li>
              <li>Driver profiles (name, phone number, driver&apos;s license information, PIN)</li>
              <li>Broker profiles (name, company, phone number, email)</li>
              <li>Customer and job data (names, addresses, materials, quantities, rates)</li>
              <li>Financial information (payroll data, invoice amounts, check records, bank account
                  numbers, routing numbers, and payment credentials)</li>
              <li>Documents and photos uploaded to the platform (driver documents, ticket photos, logos)</li>
              <li>Communications sent through the Service (SMS messages, support inquiries)</li>
            </ul>
            <p className="font-medium text-gray-900 mb-2">Information collected automatically:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Device information (operating system, device type)</li>
              <li>Usage data (features used, actions taken within the platform)</li>
              <li>Cookies and similar tracking technologies (see Section 9)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Process job assignments, tickets, invoices, and payroll</li>
              <li>Send transactional SMS messages and email communications</li>
              <li>Authenticate users and secure accounts</li>
              <li>Generate reports, trip sheets, and business analytics for your company</li>
              <li>Improve and personalize the Service</li>
              <li>Respond to customer support requests</li>
              <li>Comply with legal obligations</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Within your organization:</strong> Dispatchers can view driver, customer, broker,
                and job data within their company account as part of normal platform operations.
              </li>
              <li>
                <strong>Service providers:</strong> We use third-party services to operate the platform,
                including cloud hosting (Vercel), database hosting (PostgreSQL providers), file storage
                (Vercel Blob), and SMS delivery (Twilio). These providers access your data only to
                perform services on our behalf and are contractually obligated to protect it.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose your information if required by law,
                regulation, legal process, or governmental request.
              </li>
              <li>
                <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of
                assets, your information may be transferred as part of the transaction. We will provide
                notice before your information becomes subject to a different privacy policy.
              </li>
              <li>
                <strong>With your consent:</strong> We may share information with third parties when you
                have given us explicit consent to do so.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to
              provide the Service. We may also retain data as required to comply with legal obligations,
              resolve disputes, enforce agreements, and for legitimate business purposes (such as
              maintaining financial records).
            </p>
            <p className="mt-3">
              When data is no longer needed, we securely delete or anonymize it. You may request
              deletion of your account and associated data by contacting us (see Section 11).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Encryption of data in transit (HTTPS/TLS) and at rest</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>JWT-based session authentication with expiration</li>
              <li>Rate limiting on authentication endpoints</li>
              <li>Role-based access controls and tenant isolation</li>
              <li>Regular security audits</li>
            </ul>
            <p className="mt-3">
              No method of transmission or storage is 100% secure. While we strive to protect your
              information, we cannot guarantee absolute security. You are responsible for maintaining
              the security of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Breach Notification</h2>
            <p>
              In the event of a data breach that compromises the security, confidentiality, or integrity
              of your personal information, TruckFlowUS will:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Investigate promptly:</strong> We will conduct a thorough investigation to
                determine the nature and scope of the breach.
              </li>
              <li>
                <strong>Notify affected users:</strong> We will notify affected individuals as required
                by applicable federal and state data breach notification laws, including but not limited
                to the laws of Texas (Tex. Bus. &amp; Com. Code &sect; 521.053) and any other state
                where affected users reside. Notification will be made without unreasonable delay and
                no later than 60 days after discovery of the breach, or as otherwise required by law.
              </li>
              <li>
                <strong>Notify authorities:</strong> Where required by law, we will notify the
                appropriate state attorneys general, the Federal Trade Commission, or other regulatory
                bodies.
              </li>
              <li>
                <strong>Remediate:</strong> We will take reasonable steps to contain the breach,
                mitigate harm, and prevent future incidents.
              </li>
            </ul>
            <p className="mt-3">
              Breach notifications will include, to the extent known: a description of the incident,
              the types of information involved, the steps we are taking in response, and steps you
              can take to protect yourself. Notifications will be delivered via email to the address
              on your account and, where required, by US mail.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Sensitive Financial Data</h2>
            <p>
              Certain features of the Service (such as check printing and company payment settings)
              may allow you to enter sensitive financial information, including bank account numbers,
              routing numbers, and payment credentials. We want to be transparent about how this data
              is handled:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Storage:</strong> Financial data is stored in our secured database with
                encryption at rest and in transit. Access is restricted to authorized personnel and
                systems on a need-to-know basis.
              </li>
              <li>
                <strong>Use:</strong> Financial data you provide is used solely for the purposes
                you specify within the platform (e.g., generating checks, processing payroll records).
                We do not use this data for any other purpose.
              </li>
              <li>
                <strong>No verification:</strong> TruckFlowUS does not verify the accuracy of
                banking information you enter. We do not validate account numbers or routing numbers
                against banking institutions. You are solely responsible for ensuring this information
                is correct.
              </li>
              <li>
                <strong>No financial services:</strong> TruckFlowUS is not a bank, financial
                institution, money services business, or payment processor. We do not initiate ACH
                transfers, wire transfers, or any direct banking transactions on your behalf.
              </li>
              <li>
                <strong>Liability:</strong> TruckFlowUS is not responsible for any financial losses,
                unauthorized transactions, misdirected payments, or other damages resulting from
                inaccurate, unauthorized, or compromised financial data entered into the platform.
                See our <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link> for
                full liability terms.
              </li>
            </ul>
            <p className="mt-3">
              We strongly recommend that you limit who within your organization has access to
              financial settings, regularly review stored banking information for accuracy, and
              immediately contact us at{' '}
              <a href="mailto:support@truckflowus.com" className="text-blue-600 underline">support@truckflowus.com</a>{' '}
              if you suspect unauthorized access to your financial data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. SMS and Phone Communications</h2>
            <p>
              If a phone number is provided to TruckFlowUS (by a dispatcher adding a driver or broker),
              we may send transactional SMS messages related to job assignments and dispatch operations.
              Phone numbers are stored securely and are not shared with third parties for marketing.
            </p>
            <p className="mt-3">
              See our <Link href="/sms-terms" className="text-blue-600 underline">SMS Terms &amp; Consent</Link> page
              for full details on messaging practices, frequency, and opt-out instructions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember preferences,
              and secure your account. We use:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Essential cookies:</strong> Required for authentication and core platform
                functionality. These cannot be disabled.
              </li>
              <li>
                <strong>Functional cookies:</strong> Used to remember your preferences (such as language
                settings).
              </li>
            </ul>
            <p className="mt-3">
              We do not use advertising or third-party tracking cookies. We do not sell data collected
              through cookies. For a complete list of cookies we use, see our{' '}
              <Link href="/cookies" className="text-blue-600 underline">Cookie Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for use by individuals under the age of 18. We do not
              knowingly collect personal information from children. If we become aware that we have
              collected information from a child under 18, we will take steps to delete that information
              promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Your Privacy Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Right to access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Right to correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Right to deletion:</strong> Request deletion of your personal information, subject to certain exceptions</li>
              <li><strong>Right to opt out of SMS:</strong> Reply STOP to any TruckFlowUS message or contact your dispatcher</li>
              <li><strong>Right to non-discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
            </ul>
            <p className="mt-3 font-medium text-gray-900">California Residents (CCPA/CPRA):</p>
            <p className="mt-1">
              If you are a California resident, you have the right to know what personal information
              we collect, request its deletion, and opt out of the sale of your personal information.
              We do not sell personal information. To exercise your rights, contact us using the
              information in Section 15.
            </p>
            <p className="mt-3 font-medium text-gray-900">Virginia Residents (VCDPA):</p>
            <p className="mt-1">
              Virginia residents have the right to access, correct, delete, and obtain a copy of their
              personal data, as well as the right to opt out of the processing of personal data for
              targeted advertising, sale, or profiling. TruckFlowUS does not engage in the sale of
              personal data or profiling. To exercise your rights, contact us at the email below.
              We will respond within 45 days and you may appeal any denial.
            </p>
            <p className="mt-3 font-medium text-gray-900">Colorado Residents (CPA):</p>
            <p className="mt-1">
              Colorado residents have the right to access, correct, delete, and obtain a portable copy
              of their personal data, and to opt out of targeted advertising, the sale of personal data,
              or certain profiling. We do not sell personal data. To exercise your rights, contact us
              below. We will respond within 45 days.
            </p>
            <p className="mt-3 font-medium text-gray-900">Texas Residents (TDPSA):</p>
            <p className="mt-1">
              Texas residents have the right to confirm whether we process their personal data, to
              access and correct that data, to request deletion, and to obtain a portable copy. You
              also have the right to opt out of the sale of personal data, targeted advertising, and
              profiling. We do not sell personal data. To exercise your rights, contact us below.
              We will respond within 45 days.
            </p>
            <p className="mt-3 font-medium text-gray-900">Connecticut Residents (CTDPA):</p>
            <p className="mt-1">
              Connecticut residents have similar rights to access, correct, delete, and port their
              personal data, and to opt out of the sale of personal data, targeted advertising, and
              profiling. We do not sell personal data. Contact us below to exercise your rights.
              We will respond within 45 days.
            </p>
            <p className="mt-3 font-medium text-gray-900">Other State Privacy Laws:</p>
            <p className="mt-1">
              Several other states have enacted or are enacting comprehensive consumer privacy laws
              (including Oregon, Montana, Utah, Iowa, Indiana, Tennessee, and others). TruckFlowUS
              is committed to complying with all applicable state privacy laws. Regardless of your
              state of residence, you may contact us to exercise any privacy rights available to
              you under applicable law.
            </p>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@truckflowus.com" className="text-blue-600 underline">support@truckflowus.com</a>.
              We will respond to your request within the timeframe required by your state&apos;s law
              (typically 30–45 days). We will not discriminate against you for exercising your privacy rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services. We are not responsible
              for the privacy practices or content of these third parties. We encourage you to review
              the privacy policies of any third-party services you access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of material
              changes by posting the updated policy on this page with a revised &ldquo;Last updated&rdquo;
              date. Your continued use of the Service after changes are posted constitutes acceptance
              of the modified policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices,
              contact us at:
            </p>
            <p className="mt-2">
              <strong>TruckFlowUS</strong><br />
              Email:{' '}
              <a href="mailto:support@truckflowus.com" className="text-blue-600 underline">support@truckflowus.com</a><br />
              Website:{' '}
              <Link href="/contact" className="text-blue-600 underline">truckflowus.com/contact</Link>
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
