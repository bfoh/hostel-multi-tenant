import type { Metadata } from 'next'
import { LegalLayout, Section, Bullets } from '@/components/public/legal-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy — Beddilo',
  description: 'How Beddilo collects, uses and protects personal data.',
  alternates: { canonical: 'https://gh-hostels.com/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="30 October 2026">
      <Section heading="1. Who we are">
        <p>
          Beddilo (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an accommodation platform operated by
          [LEGAL ENTITY NAME], [COMPANY REGISTRATION NO.], of [REGISTERED ADDRESS, GHANA]. Beddilo was
          previously called GH Hostels. This policy explains how we handle personal data when property
          operators (&ldquo;Customers&rdquo;), their residents and guests (&ldquo;Occupants&rdquo; and
          &ldquo;Guests&rdquo;), and visitors who search, enquire or book on our marketplace use
          gh-hostels.com, its sub-domains and our mobile apps.
        </p>
        <p>
          For a Customer&apos;s own occupant, guest and staff records, the Customer is the data controller
          and Beddilo acts as a data processor on their behalf. For bookings and enquiries a Guest makes
          with a property, that property&apos;s operator is the controller of the booking record. We are
          the controller of marketplace account and search data.
        </p>
      </Section>

      <Section heading="2. Information we collect">
        <Bullets items={[
          <><strong>Account data</strong> — name, email, phone, property name, and login credentials.</>,
          <><strong>Property operational data</strong> — rooms, bookings, occupants, guests, staff, invoices, maintenance and accounting records you enter.</>,
          <><strong>Booking and identity details</strong> — stay dates, room choice, gender, date of birth, institution and student ID, and ID type and number (Ghana Card, passport, voter&apos;s ID or NHIS), where the property asks for them.</>,
          <><strong>Payment data</strong> — processed by Paystack. We receive transaction references, amounts, and status; we do <strong>not</strong> store full card numbers.</>,
          <><strong>Communications</strong> — emails and messages sent through the platform, including messages you send to a property&apos;s AI assistant.</>,
          <><strong>Usage &amp; device data</strong> — IP address, browser type, and activity logs for security and reliability.</>,
        ]} />
      </Section>

      <Section heading="3. How we use your data">
        <Bullets items={[
          'Provide, operate, and secure the platform.',
          'Process subscription payments and send receipts.',
          'Send transactional email (account confirmation, password reset, notifications).',
          'Provide support and respond to enquiries.',
          'Detect, prevent, and investigate fraud or abuse.',
          'Comply with legal and tax obligations.',
        ]} />
      </Section>

      <Section heading="4. Payment processing">
        <p>
          Subscription and guest payments are processed by <strong>Paystack</strong> (MTN MoMo,
          Vodafone Cash, AirtelTigo Money, Visa, Mastercard, bank transfer). Card and mobile-money
          credentials are handled directly by Paystack under its own security standards; we never see
          or store them. See Paystack&apos;s privacy policy for details.
        </p>
      </Section>

      <Section heading="5. Service providers we share data with">
        <Bullets items={[
          <><strong>Supabase</strong> — database and authentication hosting.</>,
          <><strong>Vercel</strong> — application hosting.</>,
          <><strong>Paystack</strong> — payment processing.</>,
          <><strong>Brevo</strong> — transactional email delivery.</>,
          <><strong>Arkesel</strong> — SMS delivery (where enabled).</>,
          <><strong>Anthropic</strong> — runs the AI assistant; receives the messages you send to it.</>,
          <><strong>Sentry</strong> — error monitoring; receives technical details when something goes wrong.</>,
          <><strong>Upstash</strong> — rate limiting; receives IP addresses to block abuse.</>,
          <><strong>Firebase Cloud Messaging and browser push services</strong> — deliver push notifications you have allowed.</>,
        ]} />
        <p>Some of these providers process data outside Ghana.</p>
        <p>We do not sell personal data. We share it only with the processors above and where required by law.</p>
      </Section>

      <Section heading="6. Data retention">
        <p>
          We retain account and operational data for as long as your account is active and as needed to
          provide the service. After closure, data is retained only as required for legal, tax, or
          legitimate-business purposes, then deleted or anonymised. [SPECIFY RETENTION PERIODS.]
        </p>
      </Section>

      <Section heading="7. Your rights">
        <p>
          Under the Ghana Data Protection Act, 2012 (Act 843), you may request access to, correction of,
          or deletion of your personal data, and may object to or restrict certain processing. To
          exercise these rights, contact us at [PRIVACY CONTACT EMAIL]. Occupants should direct requests
          to the property operator, who controls their records.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          Data is encrypted in transit. Each property&apos;s data is isolated at the database level using
          row-level security, and we apply access controls and audit logging. No system is perfectly
          secure, but we work to protect your information.
        </p>
      </Section>

      <Section heading="9. Cookies">
        <p>
          We use cookies and browser storage for sign-in (a Supabase session), to remember which property
          you are using, and to remember things like a food-order basket or a dismissed notice. We do not
          use analytics or advertising cookies.
        </p>
      </Section>

      <Section heading="10. Children">
        <p>The platform is intended for property operators and adult residents and guests. It is not directed at children under 18.</p>
      </Section>

      <Section heading="11. Changes to this policy">
        <p>We may update this policy from time to time. Material changes will be notified through the platform or by email. The “Last updated” date above reflects the current version.</p>
      </Section>

      <Section heading="12. Contact">
        <p>Questions about this policy: [PRIVACY CONTACT EMAIL] · [SUPPORT PHONE] · [REGISTERED ADDRESS] · Data Protection Commission registration no. [DPC REGISTRATION NO.].</p>
      </Section>
    </LegalLayout>
  )
}
