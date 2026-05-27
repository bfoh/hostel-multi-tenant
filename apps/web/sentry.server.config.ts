import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release:     process.env.VERCEL_GIT_COMMIT_SHA,

    tracesSampleRate: 0.1,

    // Ignore noisy framework cancellations and expected client disconnects.
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      'AbortError',
      'The user aborted a request',
    ],

    // Strip cookies + auth headers from server breadcrumbs.
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>).cookie
        delete (event.request.headers as Record<string, unknown>).authorization
      }
      return event
    },
  })
}
