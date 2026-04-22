import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SMS Terms & Consent — TruckFlowUS',
  description:
    'TruckFlowUS SMS messaging terms, consent policy, and opt-out instructions for drivers and brokers.',
};

export default function SmsTermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-blue-600 font-bold text-lg">
            TruckFlowUS
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMS Terms &amp; Consent</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What is TruckFlowUS?</h2>
            <p>
              TruckFlowUS is a trucking dispatch management platform that helps dispatching
              companies coordinate hauling jobs with their drivers and brokers. As part of
              this service, we send SMS (text) messages to drivers and brokers who have been
              registered on the platform by their dispatching company.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">SMS Messages We Send</h2>
            <p className="mb-3">By consenting to receive SMS from TruckFlowUS, you may receive the following types of messages:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Job assignment notifications</strong> — When you are assigned to a hauling
                job, you&apos;ll receive a text with the job number, material, pickup/delivery
                locations, and a link to view full details.
              </li>
              <li>
                <strong>Job confirmation receipts</strong> — Brokers receive a confirmation text
                when a job request submitted via SMS has been received and logged.
              </li>
              <li>
                <strong>Status updates</strong> — Occasional messages related to job status
                changes or dispatch coordination.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How Consent Is Collected</h2>
            <p>
              Your phone number is provided to TruckFlowUS by your dispatching company when
              they add you as a driver or broker on the platform. By providing your phone
              number to your dispatcher for use with TruckFlowUS, you consent to receive
              transactional SMS messages related to job assignments and dispatch operations.
            </p>
            <p className="mt-3">
              Consent is not required as a condition of purchasing any goods or services.
              Message frequency varies based on job activity — typically 1–10 messages per week.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Opting Out</h2>
            <p>
              You can opt out of SMS messages at any time by replying <strong>STOP</strong> to
              any message from TruckFlowUS. You will receive a one-time confirmation that you
              have been unsubscribed. After opting out, you will no longer receive SMS
              notifications from TruckFlowUS.
            </p>
            <p className="mt-3">
              To opt back in, reply <strong>START</strong> to the same number, or ask your
              dispatcher to re-enable SMS notifications for your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Help</h2>
            <p>
              For help, reply <strong>HELP</strong> to any message from TruckFlowUS, or
              contact us at{' '}
              <a href="mailto:support@truckflowus.com" className="text-blue-600 underline">
                support@truckflowus.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Message &amp; Data Rates</h2>
            <p>
              Message and data rates may apply. TruckFlowUS does not charge for SMS messages,
              but your mobile carrier may charge standard messaging fees depending on your plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Privacy</h2>
            <p>
              Your phone number and message content are stored securely and used only for
              dispatch operations. We do not sell, share, or rent your phone number to third
              parties for marketing purposes. For more information, see our{' '}
              <Link href="/contact" className="text-blue-600 underline">
                Contact page
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Supported Carriers</h2>
            <p>
              SMS messaging is supported on all major US carriers including AT&amp;T, Verizon,
              T-Mobile, Sprint, and most regional carriers. Carriers are not liable for
              delayed or undelivered messages.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          <Link href="/" className="text-blue-600 hover:underline">
            &larr; Back to TruckFlowUS
          </Link>
        </div>
      </div>
    </main>
  );
}
