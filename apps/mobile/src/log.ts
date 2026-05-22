export const log = {
  info:  (msg: string, ctx?: Record<string, unknown>) => console.log(`[mobile] ${msg}`, ctx ?? ''),
  warn:  (msg: string, ctx?: Record<string, unknown>) => console.warn(`[mobile] ${msg}`, ctx ?? ''),
  error: (msg: string, err?: unknown) => console.error(`[mobile] ${msg}`, err),
}
