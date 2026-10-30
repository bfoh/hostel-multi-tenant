/**
 * True when `pathname` is `prefix` itself or a path below it, matching whole
 * segments: '/book' covers /book and /book/confirm but not /bookings. A bare
 * startsWith() let dashboard routes such as /bookings and /visitors ride on
 * the public '/book' and '/visit' entries in middleware.ts.
 */
export function isUnderPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
}
