import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — TruckFlowUS',
  description:
    'TruckFlowUS Terms of Service governing the use of our trucking dispatch management platform.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-blue-600 font-bold text-lg">TruckFlowUS</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: April 21, 2026</p>

        <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the TruckFlowUS platform (&ldquo;Service&rdquo;), operated by
              TruckFlowUS (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
              you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) agree to be bound by these
              Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, you may not use the Service.
            </p>
            <p className="mt-3">
              These Terms apply to all users of the Service, including dispatchers, drivers, brokers,
              and any other individuals or entities that access or use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              TruckFlowUS is a cloud-based trucking dispatch management platform that provides tools
              for job ticketing, driver dispatch, fleet management, invoicing, payroll, trip sheet
              generation, SMS notifications, and related services for hauling and dump truck operations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
            <p>
              To use certain features of the Service, you must create an account. You agree to provide
              accurate, current, and complete information during registration and to keep your account
              information updated. You are responsible for maintaining the confidentiality of your
              account credentials (including passwords, PINs, and access tokens) and for all activity
              that occurs under your account.
            </p>
            <p className="mt-3">
              You must notify us immediately at{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>{' '}
              if you become aware of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Subscription and Fees</h2>
            <p>
              Access to TruckFlowUS may require a paid subscription. Pricing, billing cycles, and
              payment terms are presented at the time of purchase and may be updated with reasonable
              notice. All fees are non-refundable unless otherwise stated or required by law.
            </p>
            <p className="mt-3">
              We reserve the right to modify pricing with at least 30 days&apos; written notice.
              Continued use of the Service after a price change constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
              <li>Not use the Service to transmit harmful, fraudulent, or misleading information</li>
              <li>Not attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Not reverse engineer, decompile, or disassemble the Service</li>
              <li>Comply with all applicable local, state, and federal laws and regulations</li>
              <li>Ensure that all data you input into the Service is accurate and that you have the
                  right to provide such data</li>
            </ul>
            <p className="mt-3">
              Dispatching companies are responsible for ensuring that drivers and brokers they add to
              the platform have consented to the use of their personal information (including phone
              numbers) within the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service — including but not limited to
              software, text, graphics, logos, and design — are owned by TruckFlowUS and protected by
              United States and international copyright, trademark, and other intellectual property laws.
            </p>
            <p className="mt-3">
              You retain ownership of any data you input into the Service. By using the Service, you
              grant us a limited license to store, process, and display your data solely for the purpose
              of providing the Service to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data and Privacy</h2>
            <p>
              Your use of the Service is also governed by our{' '}
              <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>, which
              describes how we collect, use, and protect your information. By using the Service, you
              consent to the practices described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. User Data Responsibility and Disclaimer</h2>
            <p>
              TruckFlowUS provides a software platform for organizing, storing, and managing trucking
              dispatch data. <strong>You are solely responsible for the accuracy, legality, quality,
              and integrity of all data you enter, upload, or transmit through the Service</strong>,
              including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Driver personal information (names, phone numbers, license details, PINs)</li>
              <li>Customer and broker information (names, addresses, contact details)</li>
              <li>Job and ticket data (quantities, materials, rates, locations, dates)</li>
              <li>Financial data (payroll calculations, invoice amounts, payment records, bank
                  account numbers, routing numbers, payment credentials)</li>
              <li>Documents and photos (driver documents, ticket photos, company logos)</li>
              <li>Fleet and truck information (truck numbers, types, maintenance records)</li>
            </ul>
            <p className="mt-3">
              <strong>TruckFlowUS does not verify, audit, validate, or guarantee</strong> the accuracy,
              completeness, or legality of any data entered by users. We are a technology provider, not
              a trucking company, employer, payroll processor, financial institution, or legal advisor.
            </p>
            <p className="mt-3 font-medium text-gray-900">
              Specifically, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Payroll and financial calculations:</strong> Any payroll, payment, invoice, or
                financial calculations generated by the Service are based entirely on data you provide.
                TruckFlowUS is not responsible for errors in pay amounts, tax calculations, invoice totals,
                or any financial discrepancies arising from incorrect, incomplete, or outdated data you
                have entered. You are solely responsible for verifying all financial outputs before
                acting on them.
              </li>
              <li>
                <strong>Employee and contractor data:</strong> You are solely responsible for obtaining
                all necessary consents from drivers, brokers, employees, and independent contractors
                before entering their personal information into the Service, including their names,
                phone numbers, and financial details. TruckFlowUS is not liable for any claims arising
                from your failure to obtain proper consent or your mishandling of personal data.
              </li>
              <li>
                <strong>Regulatory and legal compliance:</strong> You are solely responsible for ensuring
                that your use of the Service complies with all applicable federal, state, and local laws,
                including but not limited to employment laws, tax regulations, DOT regulations, FMCSA
                requirements, OSHA standards, wage and hour laws, and any industry-specific regulations.
                TruckFlowUS does not provide legal, tax, regulatory, or compliance advice.
              </li>
              <li>
                <strong>SMS and communications:</strong> You are responsible for ensuring that all phone
                numbers entered into the Service belong to individuals who have consented to receive
                communications. TruckFlowUS is not liable for any claims arising from unsolicited messages
                sent through the platform due to incorrect phone numbers or lack of consent.
              </li>
              <li>
                <strong>Document accuracy:</strong> Trip sheets, invoices, tickets, checks, and other
                documents generated by the Service are produced based on data you provide. You are
                responsible for reviewing all generated documents for accuracy before distributing,
                submitting, or relying on them for any purpose.
              </li>
              <li>
                <strong>Sensitive financial data:</strong> If you choose to enter banking information,
                bank account numbers, routing numbers, payment credentials, or other sensitive financial
                data into the Service (for example, to enable check printing or payment processing
                features), you do so at your own risk. <strong>TruckFlowUS does not verify, validate,
                encrypt at the application layer beyond industry-standard practices, insure, or assume
                liability for the accuracy or security of banking credentials you provide.</strong> You
                are solely responsible for ensuring that all financial account information entered is
                accurate, authorized, and used in compliance with applicable banking regulations, ACH
                rules, and payment processing laws. TruckFlowUS is not a bank, financial institution,
                money transmitter, or payment processor and shall not be held liable for unauthorized
                transactions, incorrect transfers, overdrafts, rejected payments, or any financial
                losses arising from inaccurate or misused financial data entered into the Service.
              </li>
              <li>
                <strong>Data backup:</strong> While we take reasonable measures to protect your data,
                you are responsible for maintaining your own backups of critical business data.
                TruckFlowUS is not liable for any data loss, corruption, or unavailability, regardless
                of cause.
              </li>
              <li>
                <strong>Business decisions:</strong> Any decisions you make based on data, reports,
                analytics, or outputs from the Service are made at your own risk. TruckFlowUS is not
                responsible for any business losses, missed opportunities, or adverse outcomes resulting
                from reliance on the Service.
              </li>
            </ul>
            <p className="mt-3">
              BY USING THE SERVICE, YOU EXPRESSLY ACKNOWLEDGE THAT TRUCKFLOWUS IS A SOFTWARE TOOL AND
              NOT A SUBSTITUTE FOR PROFESSIONAL LEGAL, FINANCIAL, TAX, OR REGULATORY ADVICE. YOU ASSUME
              FULL RESPONSIBILITY FOR ALL DATA ENTERED INTO AND ALL ACTIONS TAKEN BASED ON THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. SMS and Communications</h2>
            <p>
              The Service may send SMS text messages to drivers and brokers for job assignments, status
              updates, and other operational communications. By providing a phone number to be used
              within TruckFlowUS, the user consents to receiving these messages. See our{' '}
              <Link href="/sms-terms" className="text-blue-600 underline">SMS Terms &amp; Consent</Link>{' '}
              page for full details, including opt-out instructions.
            </p>
            <p className="mt-3">
              Message and data rates may apply. We are not responsible for charges from your mobile carrier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Service Availability</h2>
            <p>
              We strive to maintain continuous availability of the Service but do not guarantee
              uninterrupted or error-free operation. We may perform scheduled or emergency maintenance
              that temporarily affects availability. We are not liable for any loss or damage resulting
              from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRUCKFLOWUS AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
              DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE
              OF THE SERVICE.
            </p>
            <p className="mt-3">
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE
              AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
              SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless TruckFlowUS and its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and
              expenses (including reasonable attorneys&apos; fees) arising out of or related to your
              use of the Service, your violation of these Terms, or your violation of any rights of
              a third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without cause,
              with or without notice. You may terminate your account at any time by contacting us at{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>.
            </p>
            <p className="mt-3">
              Upon termination, your right to use the Service ceases immediately. We may retain your
              data for a reasonable period in accordance with our Privacy Policy and applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Dispute Resolution</h2>
            <p>
              Any disputes arising out of or relating to these Terms or the Service shall first be
              attempted to be resolved through good-faith negotiation. If negotiation fails, the
              dispute shall be resolved through binding arbitration in accordance with the rules of
              the American Arbitration Association, conducted in the State of Texas.
            </p>
            <p className="mt-3">
              YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN
              INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">16. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Texas, United States of America, without regard to its conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">17. Force Majeure</h2>
            <p>
              TruckFlowUS shall not be liable for any failure or delay in performing its obligations
              under these Terms where such failure or delay results from circumstances beyond our
              reasonable control, including but not limited to: acts of God, natural disasters,
              pandemics, epidemics, government actions or orders, war, terrorism, riots, embargoes,
              labor disputes, strikes, fire, flood, earthquake, power outages, internet or
              telecommunications failures, cyberattacks, third-party service provider outages
              (including cloud hosting and SMS delivery providers), or any other force majeure event.
            </p>
            <p className="mt-3">
              During a force majeure event, our obligations under these Terms shall be suspended for
              the duration of the event. We will make reasonable efforts to notify you of the event
              and resume normal operations as soon as practicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">18. Electronic Communications Consent</h2>
            <p>
              By using the Service, you consent to receive electronic communications from TruckFlowUS,
              including but not limited to emails, SMS messages, and in-platform notifications. You agree
              that all agreements, notices, disclosures, and other communications that we provide to you
              electronically satisfy any legal requirement that such communications be in writing, pursuant
              to the federal Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15
              U.S.C. &sect; 7001 et seq.) and any applicable state laws, including the Uniform Electronic
              Transactions Act (UETA).
            </p>
            <p className="mt-3">
              You may withdraw your consent to receive electronic communications by contacting us at{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>,
              but doing so may result in termination of your access to the Service, as electronic
              communication is essential to the operation of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">19. Independent Contractor Disclaimer</h2>
            <p>
              TruckFlowUS is a software platform only. <strong>Nothing in these Terms or in the use of the
              Service creates an employment, partnership, joint venture, agency, or franchise relationship
              between TruckFlowUS and any user</strong>, including dispatchers, drivers, brokers, or their
              respective companies.
            </p>
            <p className="mt-3">
              TruckFlowUS does not employ, supervise, direct, or control any drivers, brokers, or
              dispatching personnel. The classification of workers as employees or independent contractors
              is solely the responsibility of the dispatching company or hiring entity. TruckFlowUS does
              not make, endorse, or imply any determination regarding the employment status, worker
              classification, or labor relationship of any individual whose information is entered into
              the platform.
            </p>
            <p className="mt-3">
              You are solely responsible for complying with all applicable labor, employment, tax, and
              worker classification laws, including but not limited to IRS guidelines, DOL regulations,
              state ABC tests, and any other applicable classification standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">20. Notices</h2>
            <p>
              All legal notices to TruckFlowUS must be sent via email to{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>{' '}
              with the subject line &ldquo;Legal Notice.&rdquo; Notices are deemed received on the date
              the email is sent, provided no delivery failure notification is received.
            </p>
            <p className="mt-3">
              We may provide notices to you by posting them on the Service, sending an email to the
              address associated with your account, or by SMS to the phone number on file. You are
              responsible for keeping your contact information current.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">21. Waiver</h2>
            <p>
              No failure or delay by TruckFlowUS in exercising any right, power, or remedy under these
              Terms shall operate as a waiver of that right, power, or remedy. No single or partial
              exercise of any right shall preclude any other or further exercise of that right or the
              exercise of any other right.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">22. Assignment</h2>
            <p>
              You may not assign or transfer these Terms or any rights or obligations hereunder without
              our prior written consent. TruckFlowUS may assign these Terms, in whole or in part, without
              restriction, including in connection with a merger, acquisition, corporate reorganization,
              or sale of all or substantially all of our assets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">23. US Government End Users</h2>
            <p>
              The Service is a &ldquo;commercial item&rdquo; as defined in 48 C.F.R. &sect; 2.101,
              consisting of &ldquo;commercial computer software&rdquo; and &ldquo;commercial computer
              software documentation&rdquo; as such terms are used in 48 C.F.R. &sect; 12.212. If the
              Service is acquired by or on behalf of any agency or instrumentality of the United States
              Government, the government&apos;s rights to the Service shall be only as set forth in
              these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">24. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material
              changes by posting the updated Terms on this page with a revised &ldquo;Last updated&rdquo;
              date. Your continued use of the Service after changes are posted constitutes acceptance
              of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">25. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision
              shall be limited or eliminated to the minimum extent necessary so that these Terms shall
              otherwise remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">26. Entire Agreement</h2>
            <p>
              These Terms, together with our{' '}
              <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>,{' '}
              <Link href="/sms-terms" className="text-blue-600 underline">SMS Terms</Link>, and{' '}
              <Link href="/acceptable-use" className="text-blue-600 underline">Acceptable Use Policy</Link>,
              constitute the entire agreement between you and TruckFlowUS regarding the Service and
              supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">27. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:{' '}
              <a href="mailto:admin@truckflowus.com" className="text-blue-600 underline">admin@truckflowus.com</a>
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
