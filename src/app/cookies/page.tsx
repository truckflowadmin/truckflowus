import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy — TruckFlowUS',
  description:
    'TruckFlowUS Cookie Policy explaining what cookies we use, why we use them, and how you can manage them.',
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-blue-600 font-bold text-lg">TruckFlowUS</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 21, 2026</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What Are Cookies</h2>
            <p>
              Cookies are small text files that are placed on your computer or mobile device when you
              visit a website. They are widely used to make websites work efficiently, provide a better
              user experience, and give website operators useful information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Cookies</h2>
            <p>
              TruckFlowUS uses a minimal number of cookies, all of which are essential to the operation
              of the platform. We do <strong>not</strong> use advertising cookies, third-party tracking
              cookies, or analytics cookies that share data with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cookies We Use</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-semibold text-gray-900">Cookie Name</th>
                    <th className="text-left p-3 font-semibold text-gray-900">Purpose</th>
                    <th className="text-left p-3 font-semibold text-gray-900">Type</th>
                    <th className="text-left p-3 font-semibold text-gray-900">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">auth-token</td>
                    <td className="p-3">Authenticates your session after login. Required for access to protected areas of the platform.</td>
                    <td className="p-3">Essential</td>
                    <td className="p-3">Session / 7 days</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">lang</td>
                    <td className="p-3">Stores your preferred language setting (English or Spanish).</td>
                    <td className="p-3">Functional</td>
                    <td className="p-3">1 year</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">csrf-token</td>
                    <td className="p-3">Protects against cross-site request forgery attacks. Required for security.</td>
                    <td className="p-3">Essential</td>
                    <td className="p-3">Session</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">impersonate-token</td>
                    <td className="p-3">Used by superadmin to temporarily view a tenant&apos;s account for support purposes.</td>
                    <td className="p-3">Essential</td>
                    <td className="p-3">1 hour</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Essential vs. Non-Essential Cookies</h2>
            <p>
              <strong>Essential cookies</strong> are strictly necessary for the Service to function.
              Without these cookies, you would not be able to log in, maintain a session, or securely
              use the platform. These cookies cannot be disabled.
            </p>
            <p className="mt-3">
              <strong>Functional cookies</strong> enhance your experience (such as remembering your
              language preference) but are not strictly necessary. If you disable these, you may need
              to re-select your preferences each time you visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Cookies</h2>
            <p>
              TruckFlowUS does <strong>not</strong> use third-party cookies. We do not embed
              advertising networks, social media trackers, or third-party analytics services that
              place their own cookies on your device. All cookies are first-party (set by
              TruckFlowUS directly).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Managing Cookies</h2>
            <p>
              Most web browsers allow you to control cookies through their settings. You can typically:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>View what cookies are stored on your device</li>
              <li>Delete some or all cookies</li>
              <li>Block cookies from specific or all websites</li>
              <li>Set your browser to notify you when a cookie is being placed</li>
            </ul>
            <p className="mt-3">
              Please note that if you block or delete essential cookies, you will not be able to log
              in to or use the TruckFlowUS platform. For instructions on managing cookies in your
              browser, consult your browser&apos;s help documentation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Do Not Track</h2>
            <p>
              Some browsers offer a &ldquo;Do Not Track&rdquo; (DNT) signal. Because TruckFlowUS does
              not track users across third-party websites and does not use advertising or tracking
              cookies, our practices align with DNT principles by default. We do not change our data
              practices in response to DNT signals because we already do not engage in cross-site
              tracking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our practices
              or for operational, legal, or regulatory reasons. Updates will be posted on this page
              with a revised &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Us</h2>
            <p>
              If you have questions about our use of cookies, please contact us at:{' '}
              <a href="mailto:support@truckflowus.com" className="text-blue-600 underline">support@truckflowus.com</a>
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
