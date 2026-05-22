# GH Hostels Mobile — Privacy Policy

**Last updated:** 2026-05-22

GH Hostels operates a multi-tenant hostel management platform. The mobile
app is a companion to the GH Hostels web portal for residents and tenant
owners.

This document is the source for the hosted privacy URL submitted to the
Apple App Store and Google Play. Publish it at a stable URL on a domain
you control (e.g. `https://gh-hostels.com/privacy`).

## What we collect

- **Account data** — your email, name, role, and tenant association,
  supplied at sign-up by you or your hostel.
- **Booking, payment, and maintenance data** — created by you or your
  hostel as you use the portal.
- **Device push token** — used solely to deliver in-app notifications
  (payment receipts, notices, the owner daily digest). Stored in the
  `device_push_tokens` table linked to your user. Deleted when you sign
  out or uninstall the app.
- **Camera photos** — only the photos you choose to attach (bank-draft
  uploads, and, in future versions, ID verification and maintenance
  issue photos). The app does not access your photo library beyond the
  photos you select.
- **Biometric data** — Face ID / Touch ID / fingerprint data never
  leaves your device. The app only receives a yes/no signal that the
  operating system unlocked.

## What we do NOT collect

- We do not collect contacts, location, advertising IDs, or device
  identifiers beyond the FCM/APNs push token.
- We do not share data with advertisers or third-party analytics
  services.

## Third-party services

- **Supabase** — hosts your account and hostel data (Postgres, Auth,
  Storage). https://supabase.com/privacy
- **Firebase Cloud Messaging** — delivers push notifications.
  https://firebase.google.com/support/privacy
- **Paystack** — processes online payments (rent, food orders).
  https://paystack.com/privacy

## Data retention

Account, booking, payment, and maintenance data are retained for as long
as your hostel uses the platform, in line with applicable accounting and
records-retention obligations. Push tokens are deleted on sign-out or
when the operating system reports them as invalid.

## Your rights

You can request deletion of your account at any time by contacting your
hostel administrator or emailing privacy@gh-hostels.com. Where local law
gives you a right of access, correction, or portability, contact us at
the same address.

## Contact

privacy@gh-hostels.com
