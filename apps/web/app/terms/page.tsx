import type { Metadata } from 'next'
import { LegalLayout, Section, Bullets } from '@/components/public/legal-layout'

export const metadata: Metadata = {
  title: { absolute: 'Terms of Service — Beddilo' },
  description: 'The terms that govern use of the Beddilo platform.',
  alternates: { canonical: 'https://gh-hostels.com/terms' },
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="30 October 2026">
      <Section heading="1. Agreement">
        <p>
          These Terms govern your use of the Beddilo platform (formerly GH Hostels) operated by
          [LEGAL ENTITY NAME], [COMPANY REGISTRATION NO.] (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the service, you agree to
          these Terms. If you do not agree, do not use the service.
        </p>
      </Section>

      <Section heading="2. The service">
        <p>
          Beddilo provides software for managing hostels, hotels and apartments — bookings, payments,
          invoicing, accounting, payroll, occupant and staff portals, and related features — plus a
          marketplace where guests can find properties and book or enquire with them directly. We may
          add, change, or remove features over time.
        </p>
      </Section>

      <Section heading="3. Booking a stay">
        <p>
          When you book through Beddilo, your contract for the stay is with the property, not with us.
          The property sets its prices, house rules and cancellation and refund terms, and is responsible
          for the accommodation. Payments are processed by Paystack on the property&apos;s behalf.
        </p>
      </Section>

      <Section heading="4. Accounts &amp; eligibility">
        <Bullets items={[
          'You must provide accurate information and be authorised to act for your property.',
          'You are responsible for safeguarding your login credentials and all activity under your account.',
          'You must be at least 18 years old.',
        ]} />
      </Section>

      <Section heading="5. Subscriptions &amp; billing">
        <Bullets items={[
          'Paid plans (Starter and Growth for hostels; Hotel Starter and Hotel Growth for hotels and apartments) are billed in advance through Paystack on your chosen cycle — monthly, quarterly, every 6 months, or yearly.',
          'Longer billing cycles are discounted as shown at checkout. Prices are in Ghana Cedis (GH₵) and may exclude applicable taxes/levies.',
          'Subscriptions renew automatically at the end of each cycle until cancelled.',
          'You can cancel anytime; access continues until the end of the paid period. Fees already paid are non-refundable except where required by law. [STATE YOUR REFUND POLICY.]',
          'We may change prices on reasonable prior notice; changes apply from your next renewal.',
        ]} />
      </Section>

      <Section heading="6. Free trial">
        <p>
          New accounts get a 30-day free trial of Growth-plan features. No payment details are needed to
          start, and we will not charge you unless you choose a plan. When the trial ends, your account
          switches to a limited mode until you choose a plan: your public listing stays up, and you can
          still view bookings, edit room prices and manage billing.
        </p>
      </Section>

      <Section heading="7. Acceptable use">
        <p>You agree not to:</p>
        <Bullets items={[
          'Use the service unlawfully or to store unlawful content.',
          'Attempt to breach security, access other tenants’ data, or disrupt the service.',
          'Reverse-engineer, resell, or misuse the platform.',
          'Send spam or process payments fraudulently.',
        ]} />
      </Section>

      <Section heading="8. Your data &amp; your occupants">
        <p>
          You retain ownership of the data you enter. For your occupant and staff records you are the
          data controller and are responsible for having a lawful basis to collect and process that data
          and for informing your occupants. We process it on your behalf as described in our{' '}
          <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
        </p>
      </Section>

      <Section heading="9. Intellectual property">
        <p>The platform, its software, and branding are owned by us. These Terms grant you a limited, non-exclusive, non-transferable right to use the service for your property during your subscription.</p>
      </Section>

      <Section heading="10. Third-party services">
        <p>Payments (Paystack), email (Brevo), SMS (Arkesel), hosting (Supabase, Vercel), the AI assistant (Anthropic), error monitoring (Sentry), rate limiting (Upstash), push notifications (Firebase Cloud Messaging) and similar providers are subject to their own terms. We are not liable for their acts or outages.</p>
      </Section>

      <Section heading="11. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties
          of any kind to the fullest extent permitted by law. We do not warrant that the service will be
          uninterrupted or error-free.
        </p>
      </Section>

      <Section heading="12. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental, or
          consequential losses. Our total liability for any claim is limited to the fees you paid in the
          [12] months before the claim. [CONFIRM CAP WITH COUNSEL.]
        </p>
      </Section>

      <Section heading="13. Termination">
        <p>You may stop using the service at any time. We may suspend or terminate accounts that breach these Terms or where required by law. On termination you may export your data for a reasonable period before deletion.</p>
      </Section>

      <Section heading="14. Governing law">
        <p>These Terms are governed by the laws of the Republic of Ghana, and disputes are subject to the courts of Ghana. [CONFIRM VENUE / ARBITRATION CLAUSE.]</p>
      </Section>

      <Section heading="15. Changes">
        <p>We may update these Terms. Material changes will be notified through the platform or by email and take effect on the date stated.</p>
      </Section>

      <Section heading="16. Contact">
        <p>[LEGAL ENTITY NAME] · [REGISTERED ADDRESS] · [SUPPORT EMAIL] · [SUPPORT PHONE].</p>
      </Section>
    </LegalLayout>
  )
}
